import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  AIInvalidResponseError,
} from "@/lib/errors";

import {
  DocumentRequest,
  DocumentType,
} from "@/lib/request-types";

import {
  confirmDocumentRequest,
  isManualDocumentRequest,
  resolveCustomerFromDni,
  updateRequestStatus,
} from "@/lib/request-engine";

import {
  getNextAction,
  NextAction,
} from "@/lib/request-next-action";

import {
  claimRequestForConfirmation,
  createRequestSession,
  getRequestSession,
  saveRequestSession,
} from "@/lib/server/request-store";

import {
  createRequestEvent,
} from "@/lib/server/request-event-repository";

import {
  processConfirmedRequest,
} from "@/lib/server/request-processing-dispatcher";

import {
  manualRequestService,
} from "@/lib/server/n8n-manual-request-service";

import {
  OpenAIProvider,
} from "@/lib/server/ai/openai-provider";

import {
  GeminiProvider,
} from "@/lib/server/ai/gemini-provider";

import {
  injectAIFaultIfConfigured,
} from "@/lib/server/ai/ai-fault-injection";

import {
  executeWithAIFallback,
} from "@/lib/server/ai/ai-fallback";

import {
  buildAIDegradedModeInfo,
  shouldActivateAIDegradedMode,
} from "@/lib/server/ai/ai-degraded-mode";

import {
  applyDegradedRequestInput,
  DegradedRequestInput,
} from "@/lib/server/ai/degraded-request-engine";

interface AgentRequestBody {
  message?: string;
  requestId?: string | null;
  action?:
    | "confirm_request"
    | "submit_degraded_request";
  degradedRequest?: DegradedRequestInput;
}

interface AgentExtraction {
  documentType: DocumentType;
  requestedDocumentDescription: string | null;
  dni: string | null;
  accountLast4: string | null;
  loanLast4: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  movementDate: string | null;
  movementAmount: number | null;
  movementBeneficiary: string | null;
  confirmRequest: boolean;
}

function parseExtraction(
  output: string,
): AgentExtraction {
  const cleanedOutput = output
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!cleanedOutput) {
    throw new AIInvalidResponseError(
      "OpenAI ha devuelto una respuesta vacía.",
      {
        details: {
          provider: "openai",
          reason: "empty_response",
        },
      },
    );
  }

  let parsed: Partial<AgentExtraction>;

  try {
    const parsedValue: unknown =
      JSON.parse(cleanedOutput);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      Array.isArray(parsedValue)
    ) {
      throw new AIInvalidResponseError(
        "OpenAI ha devuelto una estructura JSON no válida.",
        {
          details: {
            provider: "openai",
            reason: "invalid_json_structure",
          },
        },
      );
    }

    parsed =
      parsedValue as Partial<AgentExtraction>;
  } catch (error) {
    if (
      error instanceof
      AIInvalidResponseError
    ) {
      throw error;
    }

    throw new AIInvalidResponseError(
      "OpenAI ha devuelto una respuesta que no contiene JSON válido.",
      {
        cause: error,
        details: {
          provider: "openai",
          reason: "invalid_json",
        },
      },
    );
  }

  const allowedDocumentTypes: DocumentType[] = [
    "account_statement",
    "position_statement",
    "loan_amortization",
    "swift_confirmation",
    "unknown",
  ];

  const documentType =
    allowedDocumentTypes.includes(
      parsed.documentType as DocumentType,
    )
      ? (parsed.documentType as DocumentType)
      : "unknown";

  return {
    documentType,

    requestedDocumentDescription:
      typeof parsed.requestedDocumentDescription ===
        "string" &&
      parsed.requestedDocumentDescription.trim()
        ? parsed.requestedDocumentDescription.trim()
        : null,

    dni:
      typeof parsed.dni === "string" &&
      parsed.dni.trim()
        ? parsed.dni.trim().toUpperCase()
        : null,

    accountLast4:
      typeof parsed.accountLast4 ===
        "string" &&
      parsed.accountLast4.trim()
        ? parsed.accountLast4.trim()
        : null,

    loanLast4:
      typeof parsed.loanLast4 ===
        "string" &&
      parsed.loanLast4.trim()
        ? parsed.loanLast4.trim()
        : null,

    dateFrom:
      typeof parsed.dateFrom === "string" &&
      parsed.dateFrom.trim()
        ? parsed.dateFrom.trim()
        : null,

    dateTo:
      typeof parsed.dateTo === "string" &&
      parsed.dateTo.trim()
        ? parsed.dateTo.trim()
        : null,

    movementDate:
      typeof parsed.movementDate ===
        "string" &&
      parsed.movementDate.trim()
        ? parsed.movementDate.trim()
        : null,

    movementAmount:
      typeof parsed.movementAmount ===
      "number"
        ? parsed.movementAmount
        : null,

    movementBeneficiary:
      typeof parsed.movementBeneficiary ===
        "string" &&
      parsed.movementBeneficiary.trim()
        ? parsed.movementBeneficiary.trim()
        : null,

    confirmRequest:
      parsed.confirmRequest === true,
  };
}

function normalizeExtractionForContext(
  currentRequest: DocumentRequest,
  extraction: AgentExtraction,
): AgentExtraction {
  const normalizedExtraction = {
    ...extraction,
  };

  /*
   * Si Finora está esperando un préstamo
   * para un cuadro de amortización y el
   * modelo interpreta los cuatro dígitos
   * como una cuenta, usamos el contexto
   * determinista para corregirlo.
   */
  if (
    currentRequest.documentType ===
      "loan_amortization" &&
    currentRequest.missingFields.includes(
      "loan",
    ) &&
    normalizedExtraction.loanLast4 ===
      null &&
    normalizedExtraction.accountLast4 !==
      null
  ) {
    normalizedExtraction.loanLast4 =
      normalizedExtraction.accountLast4;

    normalizedExtraction.accountLast4 =
      null;
  }

  return normalizedExtraction;
}

function isAttemptedCustomerChange(
  currentRequest: DocumentRequest,
  extraction: AgentExtraction,
): boolean {
  return (
    currentRequest.customer.resolutionStatus ===
      "resolved" &&
    currentRequest.customer.dni !== null &&
    extraction.dni !== null &&
    extraction.dni !==
      currentRequest.customer.dni
  );
}

function applyExtraction(
  currentRequest: DocumentRequest,
  extraction: AgentExtraction,
  message: string,
): DocumentRequest {
  let documentRequest: DocumentRequest = {
    ...currentRequest,

    customer: {
      ...currentRequest.customer,
    },

    availableAccounts: [
      ...currentRequest.availableAccounts,
    ],

    availableLoans: [
      ...currentRequest.availableLoans,
    ],

    availableMovements: [
      ...currentRequest.availableMovements,
    ],

    dateRange: currentRequest.dateRange
      ? {
          ...currentRequest.dateRange,
        }
      : null,

    originalRequest:
      currentRequest.originalRequest ||
      message,
  };

  if (
    extraction.documentType !== "unknown"
  ) {
    documentRequest = {
      ...documentRequest,
      documentType:
        extraction.documentType,
      manualRequest: null,
    };
  } else if (
    extraction.requestedDocumentDescription
  ) {
    documentRequest = {
      ...documentRequest,
      documentType: "unknown",
      manualRequest: {
        requestedDocumentDescription:
          extraction.requestedDocumentDescription,
      },
      selectedAccount: null,
      selectedLoan: null,
      selectedMovement: null,
      dateRange: null,
    };
  }

  const attemptedCustomerChange =
    isAttemptedCustomerChange(
      currentRequest,
      extraction,
    );

  if (
    extraction.dni &&
    extraction.dni !==
      documentRequest.customer.dni &&
    !attemptedCustomerChange
  ) {
    const preservedDocumentType =
      documentRequest.documentType;

    const preservedDateRange =
      documentRequest.dateRange;

    const preservedManualRequest =
      documentRequest.manualRequest;

    const preservedOriginalRequest =
      documentRequest.originalRequest;

    documentRequest =
      resolveCustomerFromDni(
        documentRequest,
        extraction.dni,
      );

    documentRequest = {
      ...documentRequest,
      documentType:
        preservedDocumentType,
      dateRange:
        preservedDateRange,
      manualRequest:
        preservedManualRequest,
      originalRequest:
        preservedOriginalRequest,
    };
  }

  if (extraction.accountLast4) {
    const selectedAccount =
      documentRequest.availableAccounts.find(
        (account) =>
          account.maskedAccountNumber.endsWith(
            extraction.accountLast4 ?? "",
          ),
      ) ?? null;

    if (selectedAccount) {
      documentRequest = {
        ...documentRequest,
        selectedAccount,
      };
    }
  }

  if (extraction.loanLast4) {
    const selectedLoan =
      documentRequest.availableLoans.find(
        (loan) =>
          loan.maskedLoanNumber.endsWith(
            extraction.loanLast4 ?? "",
          ),
      ) ?? null;

    if (selectedLoan) {
      documentRequest = {
        ...documentRequest,
        selectedLoan,
      };
    }
  }

  if (
    extraction.dateFrom ||
    extraction.dateTo
  ) {
    documentRequest = {
      ...documentRequest,

      dateRange: {
        from:
          extraction.dateFrom ??
          documentRequest.dateRange
            ?.from ??
          null,

        to:
          extraction.dateTo ??
          documentRequest.dateRange
            ?.to ??
          null,
      },
    };
  }

  if (
    extraction.movementDate ||
    extraction.movementAmount !== null ||
    extraction.movementBeneficiary
  ) {
    const possibleMovements =
      documentRequest.selectedAccount
        ? documentRequest.availableMovements.filter(
            (movement) =>
              movement.accountId ===
              documentRequest
                .selectedAccount
                ?.accountId,
          )
        : documentRequest.availableMovements;

    const selectedMovement =
      possibleMovements.find(
        (movement) => {
          const matchesDate =
            !extraction.movementDate ||
            movement.date ===
              extraction.movementDate;

          const matchesAmount =
            extraction.movementAmount ===
              null ||
            Math.abs(movement.amount) ===
              Math.abs(
                extraction.movementAmount,
              );

          const matchesBeneficiary =
            !extraction.movementBeneficiary ||
            movement.description
              .toLowerCase()
              .includes(
                extraction.movementBeneficiary.toLowerCase(),
              );

          return (
            matchesDate &&
            matchesAmount &&
            matchesBeneficiary
          );
        },
      ) ?? null;

    if (selectedMovement) {
      documentRequest = {
        ...documentRequest,
        selectedMovement,
      };
    }
  }

  return updateRequestStatus(
    documentRequest,
  );
}

function hasUsefulExtraction(
  extraction: AgentExtraction,
): boolean {
  return (
    extraction.documentType !==
      "unknown" ||
    extraction.requestedDocumentDescription !==
      null ||
    extraction.dni !== null ||
    extraction.accountLast4 !== null ||
    extraction.loanLast4 !== null ||
    extraction.dateFrom !== null ||
    extraction.dateTo !== null ||
    extraction.movementDate !== null ||
    extraction.movementAmount !== null ||
    extraction.movementBeneficiary !==
      null ||
    extraction.confirmRequest
  );
}

function buildContextualNextAction(
  currentRequest: DocumentRequest,
  updatedRequest: DocumentRequest,
  extraction: AgentExtraction,
): NextAction {
  if (
    isAttemptedCustomerChange(
      currentRequest,
      extraction,
    )
  ) {
    return {
      type: "customer_not_found",
      message:
        "Esta solicitud ya está asociada a otro cliente. Para trabajar con un cliente diferente, inicia una nueva solicitud.",
    };
  }

  const nextAction =
    getNextAction(updatedRequest);

  if (!hasUsefulExtraction(extraction)) {
    if (
      currentRequest.missingFields.includes(
        "dni",
      ) ||
      nextAction.type === "ask_dni"
    ) {
      return {
        type: "ask_dni",
        message:
          "Para continuar necesito tu DNI completo, incluyendo la letra. Por ejemplo: 12345678A.",
      };
    }

    if (
      nextAction.type ===
      "ask_document_type"
    ) {
      return {
        type: "ask_document_type",
        message:
          "No he podido identificar qué documento bancario necesitas. Puedes pedirme, por ejemplo, un extracto de cuenta, un cuadro de amortización o una confirmación SWIFT.",
      };
    }

    if (
      nextAction.type === "ask_account"
    ) {
      return {
        type: "ask_account",
        message:
          "No he podido identificar la cuenta en tu mensaje. Indícame los últimos cuatro dígitos de una de las cuentas asociadas a tu perfil.",
      };
    }

    if (
      nextAction.type === "ask_loan"
    ) {
      return {
        type: "ask_loan",
        message:
          "No he podido identificar el préstamo. Indícame los últimos cuatro dígitos del préstamo para el que necesitas el cuadro de amortización.",
      };
    }

    if (
      nextAction.type ===
      "ask_date_range"
    ) {
      return {
        type: "ask_date_range",
        message:
          "No he podido identificar el periodo. Indícame una fecha inicial y una fecha final, por ejemplo: del 1 al 31 de julio de 2026.",
      };
    }

    if (
      nextAction.type ===
      "ask_movement"
    ) {
      return {
        type: "ask_movement",
        message:
          "No he podido identificar la operación. Puedes indicarme la fecha, el importe o el beneficiario de la transferencia.",
      };
    }
  }

  if (
    extraction.accountLast4 &&
    !updatedRequest.selectedAccount &&
    updatedRequest.customer
      .resolutionStatus === "resolved"
  ) {
    return {
      type: "ask_account",
      message: `No he encontrado ninguna cuenta de tu perfil terminada en ${extraction.accountLast4}. Indícame una de las cuentas asociadas a tu perfil.`,
    };
  }

  if (
    extraction.loanLast4 &&
    !updatedRequest.selectedLoan &&
    updatedRequest.customer
      .resolutionStatus === "resolved"
  ) {
    return {
      type: "ask_loan",
      message: `No he encontrado ningún préstamo de tu perfil terminado en ${extraction.loanLast4}. Indícame uno de los préstamos asociados a tu perfil.`,
    };
  }

  return nextAction;
}

function getChangedFields(
  before: DocumentRequest,
  after: DocumentRequest,
): string[] {
  const changedFields: string[] = [];

  if (
    before.documentType !==
    after.documentType
  ) {
    changedFields.push(
      "documentType",
    );
  }

  if (
    JSON.stringify(
      before.manualRequest,
    ) !==
    JSON.stringify(
      after.manualRequest,
    )
  ) {
    changedFields.push(
      "manualRequest",
    );
  }

  if (
    before.customer.customerId !==
    after.customer.customerId
  ) {
    changedFields.push(
      "customer",
    );
  }

  if (
    JSON.stringify(
      before.selectedAccount,
    ) !==
    JSON.stringify(
      after.selectedAccount,
    )
  ) {
    changedFields.push(
      "selectedAccount",
    );
  }

  if (
    JSON.stringify(
      before.selectedLoan,
    ) !==
    JSON.stringify(
      after.selectedLoan,
    )
  ) {
    changedFields.push(
      "selectedLoan",
    );
  }

  if (
    JSON.stringify(
      before.selectedMovement,
    ) !==
    JSON.stringify(
      after.selectedMovement,
    )
  ) {
    changedFields.push(
      "selectedMovement",
    );
  }

  if (
    JSON.stringify(
      before.dateRange,
    ) !==
    JSON.stringify(
      after.dateRange,
    )
  ) {
    changedFields.push(
      "dateRange",
    );
  }

  if (
    JSON.stringify(
      before.missingFields,
    ) !==
    JSON.stringify(
      after.missingFields,
    )
  ) {
    changedFields.push(
      "missingFields",
    );
  }

  if (
    before.status !== after.status
  ) {
    changedFields.push(
      "status",
    );
  }

  return changedFields;
}

async function recordRequestUpdateEvents(
  requestId: string,
  before: DocumentRequest,
  after: DocumentRequest,
) {
  const changedFields =
    getChangedFields(
      before,
      after,
    );

  if (changedFields.length > 0) {
    await createRequestEvent(
      requestId,
      "request_updated",
      {
        changedFields,
        documentType:
          after.documentType,
        status:
          after.status,
        missingFields:
          after.missingFields,
        customerId:
          after.customer.customerId,
      },
    );
  }

  if (
    before.status !==
      "ready_for_confirmation" &&
    after.status ===
      "ready_for_confirmation"
  ) {
    await createRequestEvent(
      requestId,
      "request_ready_for_confirmation",
      {
        documentType:
          after.documentType,
        customerId:
          after.customer.customerId,
      },
    );
  }
}

async function registerConfirmedManualRequest(
  requestId: string,
  requestState: DocumentRequest,
) {
  const pendingManualRequest: DocumentRequest = {
    ...requestState,
    status: "pending_manual_processing",
  };

  await saveRequestSession(
    requestId,
    pendingManualRequest,
  );

  await createRequestEvent(
    requestId,
    "manual_request_pending",
    {
      documentType:
        pendingManualRequest.documentType,
      requestedDocumentDescription:
        pendingManualRequest.manualRequest
          ?.requestedDocumentDescription ??
        null,
      customerId:
        pendingManualRequest.customer
          .customerId,
      previousStatus: "confirmed",
      status:
        "pending_manual_processing",
    },
  );

  return pendingManualRequest;
}

async function dispatchManualRequest(
  requestId: string,
  requestState: DocumentRequest,
) {
  const dispatchResult =
    await manualRequestService.dispatch(
      requestId,
      requestState,
    );

  if (
    dispatchResult.status === "accepted"
  ) {
    const manualProcessingRequest: DocumentRequest = {
      ...requestState,
      status: "manual_processing",
    };

    await saveRequestSession(
      requestId,
      manualProcessingRequest,
    );

    await createRequestEvent(
      requestId,
      "manual_request_dispatched",
      {
        documentType:
          manualProcessingRequest.documentType,
        requestedDocumentDescription:
          manualProcessingRequest.manualRequest
            ?.requestedDocumentDescription ??
          null,
        customerId:
          manualProcessingRequest.customer
            .customerId,
        provider:
          dispatchResult.provider,
        externalReference:
          dispatchResult.externalReference,
        acceptedAt:
          dispatchResult.acceptedAt,
        previousStatus:
          "pending_manual_processing",
        status:
          "manual_processing",
      },
    );

    return {
      requestState:
        manualProcessingRequest,

      nextAction: {
        type:
          "request_manual_processing",
        message:
          "Solicitud enviada correctamente para su tramitación manual. Un gestor deberá preparar el documento antes de que quede disponible.",
      },
    };
  }

  await createRequestEvent(
    requestId,
    "manual_request_dispatch_failed",
    {
      documentType:
        requestState.documentType,
      requestedDocumentDescription:
        requestState.manualRequest
          ?.requestedDocumentDescription ??
        null,
      customerId:
        requestState.customer.customerId,
      provider:
        dispatchResult.provider,
      error:
        dispatchResult.error,
      status:
        requestState.status,
    },
  );

  return {
    requestState,

    nextAction: {
      type:
        "request_pending_manual_processing",
      message:
        "La solicitud ha quedado registrada, pero no ha podido enviarse al circuito de tramitación manual. Permanece pendiente para evitar perderla.",
    },
  };
}

async function registerAndDispatchConfirmedManualRequest(
  requestId: string,
  requestState: DocumentRequest,
) {
  const pendingManualRequest =
    await registerConfirmedManualRequest(
      requestId,
      requestState,
    );

  return dispatchManualRequest(
    requestId,
    pendingManualRequest,
  );
}

async function getExistingManualConfirmationResult(
  requestId: string,
) {
  const latestRequest =
    await getRequestSession(
      requestId,
    );

  if (!latestRequest) {
    return null;
  }

  const requestState =
    latestRequest.requestState;

  if (
    !isManualDocumentRequest(
      requestState,
    )
  ) {
    return null;
  }

  if (
    requestState.status ===
    "manual_processing"
  ) {
    return {
      requestState,

      nextAction: {
        type:
          "request_manual_processing",
        message:
          "La solicitud ya ha sido enviada para su tramitación manual. No se ha iniciado un envío duplicado.",
      },
    };
  }

  if (
    requestState.status ===
    "pending_manual_processing"
  ) {
    return {
      requestState,

      nextAction: {
        type:
          "request_pending_manual_processing",
        message:
          "La solicitud manual ya está registrada y permanece pendiente de tramitación. No se ha iniciado un envío duplicado.",
      },
    };
  }

  return null;
}

async function processJustConfirmedRequest(
  requestId: string,
) {
  const processingResult =
    await processConfirmedRequest(
      requestId,
    );

  if (
    processingResult.requestState.status ===
    "completed"
  ) {
    return {
      requestState:
        processingResult.requestState,

      nextAction: {
        type:
          "request_processing_completed",
        message:
          processingResult.duplicatePrevented
            ? "La solicitud ya había sido procesada. El documento está preparado."
            : "Solicitud procesada correctamente. El documento ya está preparado.",
      },
    };
  }

  if (
    processingResult.duplicatePrevented &&
    processingResult.requestState.status ===
      "processing"
  ) {
    return {
      requestState:
        processingResult.requestState,

      nextAction: {
        type:
          "request_processing_in_progress",
        message:
          "La solicitud ya está siendo procesada. No se ha iniciado un procesamiento duplicado.",
      },
    };
  }

  return {
    requestState:
      processingResult.requestState,

    nextAction: {
      type:
        "request_processing_failed",
      message:
        "La solicitud se ha confirmado, pero se ha producido un error durante el procesamiento.",
    },
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const requestId =
      request.nextUrl.searchParams.get(
        "requestId",
      );

    if (!requestId) {
      return NextResponse.json(
        {
          error:
            "El identificador de la solicitud es obligatorio.",
          code:
            "SESSION_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const storedRequest =
      await getRequestSession(
        requestId,
      );

    if (!storedRequest) {
      return NextResponse.json(
        {
          error:
            "No se ha encontrado la sesión de la solicitud.",
          code:
            "SESSION_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const nextAction =
      getNextAction(
        storedRequest.requestState,
      );

    return NextResponse.json({
      requestId:
        storedRequest.requestId,

      receivedMessage: null,

      agent: {
        mode:
          "session_recovery",
        provider:
          "finora-engine",
        model: null,
      },

      extraction: null,

      requestState:
        storedRequest.requestState,

      nextAction,
    });
  } catch (error) {
    console.error(
      "Agent session recovery error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No se ha podido recuperar la solicitud.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      (await request.json()) as AgentRequestBody;

    /*
     * Confirmación explícita desde
     * el botón de la interfaz.
     */
    if (
      body.action ===
      "confirm_request"
    ) {
      if (!body.requestId) {
        return NextResponse.json(
          {
            error:
              "No se ha encontrado la sesión de la solicitud.",
            code:
              "SESSION_REQUIRED",
          },
          {
            status: 400,
          },
        );
      }

      const storedRequest =
        await getRequestSession(
          body.requestId,
        );

      if (!storedRequest) {
        return NextResponse.json(
          {
            error:
              "La sesión de la solicitud ha caducado. Inicia una nueva solicitud.",
            code:
              "SESSION_NOT_FOUND",
          },
          {
            status: 404,
          },
        );
      }

      const currentRequest =
        storedRequest.requestState;

      const documentRequest =
        confirmDocumentRequest(
          currentRequest,
        );

      const wasJustConfirmed =
        currentRequest.status ===
          "ready_for_confirmation" &&
        documentRequest.status ===
          "confirmed";

      if (wasJustConfirmed) {
        const confirmationClaim =
          await claimRequestForConfirmation(
            storedRequest.requestId,
            documentRequest,
          );

        if (confirmationClaim) {
          await recordRequestUpdateEvents(
            storedRequest.requestId,
            currentRequest,
            confirmationClaim.requestState,
          );

          await createRequestEvent(
            storedRequest.requestId,
            "request_confirmed",
            {
              documentType:
                confirmationClaim.requestState
                  .documentType,

              customerId:
                confirmationClaim.requestState
                  .customer.customerId,

              processingMode:
                isManualDocumentRequest(
                  confirmationClaim.requestState,
                )
                  ? "manual"
                  : "automatic",
            },
          );

          if (
            isManualDocumentRequest(
              confirmationClaim.requestState,
            )
          ) {
            const manualResult =
              await registerAndDispatchConfirmedManualRequest(
                storedRequest.requestId,
                confirmationClaim.requestState,
              );

            return NextResponse.json({
              requestId:
                storedRequest.requestId,

              receivedMessage: null,

              agent: {
                mode:
                  "deterministic",
                provider:
                  "finora-engine",
                model: null,
              },

              extraction: null,

              requestState:
                manualResult.requestState,

              nextAction:
                manualResult.nextAction,
            });
          }
        }

        const existingManualResult =
          await getExistingManualConfirmationResult(
            storedRequest.requestId,
          );

        if (existingManualResult) {
          return NextResponse.json({
            requestId:
              storedRequest.requestId,

            receivedMessage: null,

            agent: {
              mode:
                "deterministic",
              provider:
                "finora-engine",
              model: null,
            },

            extraction: null,

            requestState:
              existingManualResult.requestState,

            nextAction:
              existingManualResult.nextAction,
          });
        }

        /*
         * Las solicitudes automáticas continúan
         * hacia el dispatcher. Allí un segundo claim
         * atómico garantiza que solo una ejecución
         * pueda pasar de confirmed a processing.
         *
         * Una petición concurrente que no obtuvo el
         * claim de confirmación también llega al
         * dispatcher, que evita el procesamiento
         * duplicado.
         */
        const processed =
          await processJustConfirmedRequest(
            storedRequest.requestId,
          );

        return NextResponse.json({
          requestId:
            storedRequest.requestId,

          receivedMessage: null,

          agent: {
            mode:
              "deterministic",
            provider:
              "finora-engine",
            model: null,
          },

          extraction: null,

          requestState:
            processed.requestState,

          nextAction:
            processed.nextAction,
        });
      }

      await saveRequestSession(
        storedRequest.requestId,
        documentRequest,
      );

      await recordRequestUpdateEvents(
        storedRequest.requestId,
        currentRequest,
        documentRequest,
      );

      const nextAction =
        getNextAction(
          documentRequest,
        );

      return NextResponse.json({
        requestId:
          storedRequest.requestId,

        receivedMessage: null,

        agent: {
          mode:
            "deterministic",
          provider:
            "finora-engine",
          model: null,
        },

        extraction: null,

        requestState:
          documentRequest,

        nextAction,
      });
    }

    /*
     * Modo de contingencia determinista.
     *
     * El navegador solo envía identificadores y datos
     * estructurados. El servidor vuelve a resolver y
     * validar toda la información contra los datos
     * bancarios de confianza.
     */
    if (
      body.action ===
      "submit_degraded_request"
    ) {
      if (!body.requestId) {
        return NextResponse.json(
          {
            error:
              "No se ha encontrado la sesión de la solicitud.",
            code:
              "SESSION_REQUIRED",
          },
          {
            status: 400,
          },
        );
      }

      if (!body.degradedRequest) {
        return NextResponse.json(
          {
            error:
              "Los datos del modo de contingencia son obligatorios.",
            code:
              "DEGRADED_REQUEST_REQUIRED",
          },
          {
            status: 400,
          },
        );
      }

      const storedRequest =
        await getRequestSession(
          body.requestId,
        );

      if (!storedRequest) {
        return NextResponse.json(
          {
            error:
              "La sesión de la solicitud ha caducado. Inicia una nueva solicitud.",
            code:
              "SESSION_NOT_FOUND",
          },
          {
            status: 404,
          },
        );
      }

      const currentRequest =
        storedRequest.requestState;

      const degradedResult =
        applyDegradedRequestInput(
          currentRequest,
          body.degradedRequest,
        );

      const documentRequest =
        degradedResult.requestState;

      await saveRequestSession(
        storedRequest.requestId,
        documentRequest,
      );

      await recordRequestUpdateEvents(
        storedRequest.requestId,
        currentRequest,
        documentRequest,
      );

      const nextAction =
        getNextAction(
          documentRequest,
        );

      return NextResponse.json({
        requestId:
          storedRequest.requestId,

        receivedMessage: null,

        agent: {
          mode:
            "degraded",
          provider:
            "finora-engine",
          model: null,
        },

        degradedMode: {
          active: true,
          validationErrors:
            degradedResult.validationErrors,
        },

        extraction: null,

        requestState:
          documentRequest,

        validationErrors:
          degradedResult.validationErrors,

        nextAction,
      });
    }

    if (
      !process.env.OPENAI_API_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    const message =
      body.message?.trim();

    if (!message) {
      return NextResponse.json(
        {
          error:
            "El mensaje es obligatorio.",
        },
        {
          status: 400,
        },
      );
    }

    let storedRequest;
    let wasCreated = false;

    if (body.requestId) {
      storedRequest =
        await getRequestSession(
          body.requestId,
        );

      if (!storedRequest) {
        return NextResponse.json(
          {
            error:
              "La sesión de la solicitud ha caducado. Inicia una nueva solicitud.",
            code:
              "SESSION_NOT_FOUND",
          },
          {
            status: 404,
          },
        );
      }
    } else {
      storedRequest =
        await createRequestSession();

      wasCreated = true;

      await createRequestEvent(
        storedRequest.requestId,
        "session_created",
        {
          initialStatus:
            storedRequest.requestState
              .status,
        },
      );
    }

    /*
     * Registramos la existencia del mensaje,
     * pero no duplicamos el texto completo
     * dentro de la auditoría.
     */
    await createRequestEvent(
      storedRequest.requestId,
      "message_received",
      {
        channel: "chat",
        createdSession:
          wasCreated,
      },
    );

    const currentRequest =
      storedRequest.requestState;

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    const currentNextAction =
      getNextAction(
        currentRequest,
      );

    const openAIProvider =
      new OpenAIProvider(
        process.env.OPENAI_API_KEY,
      );

    const geminiProvider =
      process.env.GEMINI_API_KEY
        ? new GeminiProvider(
            process.env.GEMINI_API_KEY,
          )
        : undefined;

    const aiInstructions = `
You are the natural-language understanding layer of Finora Docs AI,
a Spanish banking document request assistant.

The customer communicates in Spanish.

Your job is ONLY to extract structured information from the latest
customer message. Do not answer the customer.

Current date: ${today}

Current document type: ${currentRequest.documentType}
Current manual document description: ${currentRequest.manualRequest?.requestedDocumentDescription ?? "none"}
Current next action expected by the deterministic engine: ${currentNextAction.type}

Use this conversation context when interpreting ambiguous language.

For example:
- if the current document type is loan_amortization and the system is
  currently asking for a loan, four final digits should normally be
  interpreted as loanLast4 even if the customer casually calls it
  "cuenta", "producto" or simply provides the number;
- if the system is asking for an account, four final digits should
  normally be interpreted as accountLast4.

Supported document types:

- account_statement:
  account statement, bank statement, account extract, extracto de cuenta,
  movimientos or transactions for a period.

- position_statement:
  statement or certificate showing balances, holdings, investment
  positions or financial position.

- loan_amortization:
  loan or mortgage amortization schedule, cuadro de amortización.

- swift_confirmation:
  SWIFT confirmation, justificante SWIFT or proof of an international
  bank transfer.

- unknown:
  use this when the customer is asking for a banking document that is not
  one of the four automated document types above, OR when the document
  cannot yet be reliably identified.

For a banking document request that is clearly identifiable but is not
one of the four automated document types:
- set documentType to "unknown";
- set requestedDocumentDescription to a short, faithful Spanish name for
  the requested document;
- examples include "certificado de titularidad", "certificado de deuda",
  "certificado fiscal" or another clearly requested banking document;
- do not map an unsupported document to a supported type merely because
  it sounds similar.

For greetings, insults, casual conversation or messages that do not
contain a banking document request, requestedDocumentDescription must be
null.

Extract a Spanish DNI only when a complete DNI is explicitly provided.
A DNI must contain 8 digits followed by one letter.
Do not interpret incomplete numbers as a DNI.

If the customer identifies an account by its final digits,
extract exactly those final 4 digits.

If the customer identifies a loan by its final digits,
extract exactly those final 4 digits.

For date ranges:
- convert dates to YYYY-MM-DD when they can be understood reliably;
- do not invent dates;
- use null when a boundary cannot be determined.

For transfer movements:
- extract date if explicitly identifiable;
- extract numeric amount if provided;
- extract beneficiary text if provided.

Set confirmRequest to true only when the customer is clearly confirming
the current request, for example:
- "sí, confirma"
- "confirmo"
- "adelante"
- "está correcto"
- "puedes tramitarlo"

Do not interpret a generic "sí" as confirmation unless it clearly refers
to confirming the request.

Messages unrelated to banking document requests, insults, greetings or
casual conversation must not be forced into any field.
Return null or unknown for fields that are not actually present.

Do not invent information.

Return ONLY valid JSON.
Do not use Markdown.
Do not add explanations.

Return exactly this JSON shape:

{
  "documentType": "account_statement" | "position_statement" | "loan_amortization" | "swift_confirmation" | "unknown",
  "requestedDocumentDescription": string | null,
  "dni": string | null,
  "accountLast4": string | null,
  "loanLast4": string | null,
  "dateFrom": string | null,
  "dateTo": string | null,
  "movementDate": string | null,
  "movementAmount": number | null,
  "movementBeneficiary": string | null,
  "confirmRequest": boolean
}
    `.trim();

    let aiResult;

    try {
      aiResult =
        await executeWithAIFallback(
          {
            instructions:
              aiInstructions,
            input: message,
          },
          {
            primaryProvider:
              openAIProvider,
            fallbackProvider:
              geminiProvider,

            beforeAttempt: (
              provider,
              attempt,
            ) => {
              injectAIFaultIfConfigured(
                attempt,
                provider.name,
              );
            },
          },
        );
    } catch (error) {
      if (
        shouldActivateAIDegradedMode(
          error,
        )
      ) {
        const degradedMode =
          buildAIDegradedModeInfo(
            error,
          );

        await createRequestEvent(
          storedRequest.requestId,
          "ai_degraded_mode_activated",
          {
            code:
              degradedMode.code,
            reason:
              degradedMode.reason,
            originalErrorCode:
              degradedMode.originalErrorCode,
            primaryProvider:
              openAIProvider.name,
            fallbackProvider:
              geminiProvider?.name ?? null,
          },
        );

        console.warn(
          `[Finora AI] Todos los proveedores disponibles han fallado. ` +
            `Activando modo degradado para la solicitud ${storedRequest.requestId}. ` +
            `Código: ${degradedMode.originalErrorCode}.`,
        );

        return NextResponse.json({
          requestId:
            storedRequest.requestId,

          receivedMessage:
            message,

          agent: {
            mode: "degraded",
            provider:
              "finora-engine",
            model: null,
          },

          degradedMode,

          extraction: null,

          requestState:
            currentRequest,

          nextAction: {
            type:
              "ai_degraded_mode",
            message:
              "Los servicios de interpretación automática no están disponibles temporalmente. Puedes continuar la solicitud mediante el modo de contingencia.",
          },
        });
      }

      throw error;
    }

    const {
      response,
      fallback,
    } = aiResult;

    await createRequestEvent(
      storedRequest.requestId,
      "ai_generation_completed",
      {
        provider:
          response.provider,
        model:
          response.model,
        inputTokens:
          response.usage.inputTokens,
        outputTokens:
          response.usage.outputTokens,
        totalTokens:
          response.usage.totalTokens,
        fallbackUsed:
          fallback.used,
      },
    );

    if (fallback.used) {
      await createRequestEvent(
        storedRequest.requestId,
        "ai_fallback_activated",
        {
          fromProvider:
            fallback.fromProvider,
          toProvider:
            fallback.toProvider,
          reason:
            fallback.reason,
        },
      );
    }

    console.info(
      `[Finora AI] Respuesta recibida de ${response.provider}/${response.model}. Tokens: input=${response.usage.inputTokens ?? "n/a"}, output=${response.usage.outputTokens ?? "n/a"}, total=${response.usage.totalTokens ?? "n/a"}.`,
    );

    const rawExtraction =
      parseExtraction(
        response.outputText,
      );

    const extraction =
      normalizeExtractionForContext(
        currentRequest,
        rawExtraction,
      );

    const attemptedCustomerChange =
      isAttemptedCustomerChange(
        currentRequest,
        extraction,
      );

    let documentRequest =
      applyExtraction(
        currentRequest,
        extraction,
        message,
      );

    if (
      attemptedCustomerChange
    ) {
      await createRequestEvent(
        storedRequest.requestId,
        "customer_change_rejected",
        {
          existingCustomerId:
            currentRequest.customer
              .customerId,
        },
      );
    }

    if (
      extraction.confirmRequest &&
      !attemptedCustomerChange
    ) {
      documentRequest =
        confirmDocumentRequest(
          documentRequest,
        );
    }

    const nextAction =
      buildContextualNextAction(
        currentRequest,
        documentRequest,
        extraction,
      );

    const wasJustConfirmed =
      currentRequest.status ===
        "ready_for_confirmation" &&
      documentRequest.status ===
        "confirmed";

    if (wasJustConfirmed) {
      const confirmationClaim =
        await claimRequestForConfirmation(
          storedRequest.requestId,
          documentRequest,
        );

      if (confirmationClaim) {
        await recordRequestUpdateEvents(
          storedRequest.requestId,
          currentRequest,
          confirmationClaim.requestState,
        );

        await createRequestEvent(
          storedRequest.requestId,
          "request_confirmed",
          {
            documentType:
              confirmationClaim.requestState
                .documentType,

            customerId:
              confirmationClaim.requestState
                .customer.customerId,

            processingMode:
              isManualDocumentRequest(
                confirmationClaim.requestState,
              )
                ? "manual"
                : "automatic",
          },
        );

        if (
          isManualDocumentRequest(
            confirmationClaim.requestState,
          )
        ) {
          const manualResult =
            await registerAndDispatchConfirmedManualRequest(
              storedRequest.requestId,
              confirmationClaim.requestState,
            );

          return NextResponse.json({
            requestId:
              storedRequest.requestId,

            receivedMessage:
              message,

            agent: {
              mode: "ai",
              provider:
                response.provider,
              model:
                response.model,
              usage:
                response.usage,
            },

            extraction,

            requestState:
              manualResult.requestState,

            nextAction:
              manualResult.nextAction,
          });
        }
      }

      const existingManualResult =
        await getExistingManualConfirmationResult(
          storedRequest.requestId,
        );

      if (existingManualResult) {
        return NextResponse.json({
          requestId:
            storedRequest.requestId,

          receivedMessage:
            message,

          agent: {
            mode: "ai",
            provider:
              response.provider,
            model:
              response.model,
            usage:
              response.usage,
          },

          extraction,

          requestState:
            existingManualResult.requestState,

          nextAction:
            existingManualResult.nextAction,
        });
      }

      /*
       * Las solicitudes automáticas confirmadas
       * continúan hacia el dispatcher. El claim
       * PostgreSQL evita que una segunda petición
       * reabra el estado confirmed.
       */
      const processed =
        await processJustConfirmedRequest(
          storedRequest.requestId,
        );

      return NextResponse.json({
        requestId:
          storedRequest.requestId,

        receivedMessage:
          message,

        agent: {
          mode: "ai",
          provider:
            response.provider,
          model:
            response.model,
          usage:
            response.usage,
        },

        extraction,

        requestState:
          processed.requestState,

        nextAction:
          processed.nextAction,
      });
    }

    await saveRequestSession(
      storedRequest.requestId,
      documentRequest,
    );

    await recordRequestUpdateEvents(
      storedRequest.requestId,
      currentRequest,
      documentRequest,
    );

    return NextResponse.json({
      requestId:
        storedRequest.requestId,

      receivedMessage:
        message,

      agent: {
        mode: "ai",
        provider:
          response.provider,
        model:
          response.model,
        usage:
          response.usage,
      },

      extraction,

      requestState:
        documentRequest,

      nextAction,
    });
  } catch (error) {
    console.error(
      "Agent API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No se ha podido procesar la solicitud con el agente de IA.",
      },
      {
        status: 500,
      },
    );
  }
}
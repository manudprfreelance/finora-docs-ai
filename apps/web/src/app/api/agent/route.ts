import OpenAI from "openai";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  DocumentRequest,
  DocumentType,
} from "@/lib/request-types";

import {
  confirmDocumentRequest,
  resolveCustomerFromDni,
  updateRequestStatus,
} from "@/lib/request-engine";

import {
  getNextAction,
  NextAction,
} from "@/lib/request-next-action";

import {
  createRequestSession,
  getRequestSession,
  saveRequestSession,
} from "@/lib/server/request-store";

interface AgentRequestBody {
  message?: string;
  requestId?: string | null;
  action?: "confirm_request";
}

interface AgentExtraction {
  documentType: DocumentType;
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseExtraction(
  output: string,
): AgentExtraction {
  const cleanedOutput = output
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(
    cleanedOutput,
  ) as Partial<AgentExtraction>;

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
   * En un cuadro de amortización, si el
   * siguiente dato pendiente es el préstamo
   * y el modelo interpreta los cuatro
   * dígitos como una cuenta, usamos el
   * contexto determinista para corregirlo.
   *
   * Ejemplo:
   * "Para la cuenta 7721"
   *
   * Aunque el cliente diga "cuenta",
   * Finora acaba de preguntarle por uno
   * de sus préstamos, por lo que 7721
   * debe interpretarse como loanLast4.
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
      dateRange: preservedDateRange,
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
          documentRequest.dateRange?.to ??
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
          code: "SESSION_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const storedRequest =
      await getRequestSession(requestId);

    if (!storedRequest) {
      return NextResponse.json(
        {
          error:
            "No se ha encontrado la sesión de la solicitud.",
          code: "SESSION_NOT_FOUND",
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
        mode: "session_recovery",
        provider: "finora-engine",
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

    if (
      body.action ===
      "confirm_request"
    ) {
      if (!body.requestId) {
        return NextResponse.json(
          {
            error:
              "No se ha encontrado la sesión de la solicitud.",
            code: "SESSION_REQUIRED",
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
            code: "SESSION_NOT_FOUND",
          },
          {
            status: 404,
          },
        );
      }

      const documentRequest =
        confirmDocumentRequest(
          storedRequest.requestState,
        );

      await saveRequestSession(
        storedRequest.requestId,
        documentRequest,
      );

      const nextAction =
        getNextAction(documentRequest);

      return NextResponse.json({
        requestId:
          storedRequest.requestId,

        receivedMessage: null,

        agent: {
          mode: "deterministic",
          provider: "finora-engine",
          model: null,
        },

        extraction: null,
        requestState:
          documentRequest,
        nextAction,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
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
            code: "SESSION_NOT_FOUND",
          },
          {
            status: 404,
          },
        );
      }
    } else {
      storedRequest =
        await createRequestSession();
    }

    const currentRequest =
      storedRequest.requestState;

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    const currentNextAction =
      getNextAction(currentRequest);

    const response =
      await openai.responses.create({
        model: "gpt-5.6-luna",

        instructions: `
You are the natural-language understanding layer of Finora Docs AI,
a Spanish banking document request assistant.

The customer communicates in Spanish.

Your job is ONLY to extract structured information from the latest
customer message. Do not answer the customer.

Current date: ${today}

Current document type: ${currentRequest.documentType}
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
  only when the document cannot be reliably identified from this message.

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
        `.trim(),

        input: message,
      });

    const rawExtraction =
      parseExtraction(
        response.output_text,
      );

    /*
     * OpenAI interpreta el lenguaje.
     * El motor determinista añade después
     * el contexto de negocio necesario para
     * resolver ambigüedades.
     */
    const extraction =
      normalizeExtractionForContext(
        currentRequest,
        rawExtraction,
      );

    let documentRequest =
      applyExtraction(
        currentRequest,
        extraction,
        message,
      );

    if (
      extraction.confirmRequest &&
      !isAttemptedCustomerChange(
        currentRequest,
        extraction,
      )
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

    await saveRequestSession(
      storedRequest.requestId,
      documentRequest,
    );

    return NextResponse.json({
      requestId:
        storedRequest.requestId,

      receivedMessage: message,

      agent: {
        mode: "openai",
        provider: "openai",
        model: "gpt-5.6-luna",
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
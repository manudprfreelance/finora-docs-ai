"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  DocumentRequest,
  DocumentType,
} from "@/lib/request-types";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

interface AgentApiResponse {
  requestId: string;

  receivedMessage: string | null;

  agent: {
    mode: string;
    provider: string;
    model: string | null;
  };

  degradedMode?: {
    active?: boolean;
    validationErrors?: string[];
  };

  validationErrors?: string[];

  requestState: DocumentRequest;

  nextAction: {
    type: string;
    message: string;
  };
}

interface DegradedRequestForm {
  documentType: DocumentType;
  dni: string;
  accountId: string;
  loanId: string;
  movementId: string;
  dateFrom: string;
  dateTo: string;
}

interface AgentApiError {
  error: string;
  code?: string;
}

const ACTIVE_REQUEST_STORAGE_KEY =
  "finora.activeRequestId";

const INITIAL_ASSISTANT_MESSAGE =
  "Hola, soy Finora. Dime qué documento bancario necesitas y te ayudaré a solicitarlo.";

const documentTypeLabels: Record<
  DocumentType,
  string
> = {
  account_statement:
    "Extracto de cuenta",
  position_statement:
    "Estado de posición",
  loan_amortization:
    "Cuadro de amortización",
  swift_confirmation:
    "Confirmación SWIFT",
  unknown:
    "Sin identificar",
};

const missingFieldLabels: Record<
  string,
  string
> = {
  dni:
    "DNI",
  customer:
    "Cliente",
  documentType:
    "Tipo de documento",
  account:
    "Cuenta",
  dateRange:
    "Periodo",
  loan:
    "Préstamo",
  movement:
    "Operación",
};

function getStatusLabel(
  status: DocumentRequest["status"],
): string {
  switch (status) {
    case "collecting_information":
      return "Recopilando información";

    case "ready_for_confirmation":
      return "Lista para confirmar";

    case "confirmed":
      return "Confirmada";

    case "processing":
      return "Procesando";

    case "pending_manual_processing":
      return "Pendiente de tramitación manual";

    case "manual_processing":
      return "En tramitación manual";

    case "completed":
      return "Completada";

    case "failed":
      return "Fallida";

    default:
      return status;
  }
}

function getRecoveryMessage(
  requestState: DocumentRequest,
  fallbackMessage: string,
): string {
  switch (requestState.status) {
    case "processing":
      return "Tu solicitud está siendo procesada.";

    case "pending_manual_processing":
      return "Tu solicitud requiere tramitación manual y está pendiente de gestión.";

    case "manual_processing":
      return "Tu solicitud está siendo tramitada manualmente.";

    case "completed":
      return "Tu solicitud ya ha sido procesada correctamente y el documento está preparado.";

    case "failed":
      return "La solicitud está registrada, pero se produjo un error durante su procesamiento.";

    case "confirmed":
      return "Tu solicitud está confirmada y preparada para su procesamiento.";

    default:
      return fallbackMessage;
  }
}

function getDefaultPdfFileName(
  documentType: DocumentType,
  requestId: string,
): string {
  switch (documentType) {
    case "account_statement":
      return `account-statement-${requestId}.pdf`;

    case "loan_amortization":
      return `loan-amortization-${requestId}.pdf`;

    case "swift_confirmation":
      return `swift-confirmation-${requestId}.pdf`;

    case "position_statement":
      return `position-statement-${requestId}.pdf`;

    default:
      return `finora-document-${requestId}.pdf`;
  }
}

export default function RequestPage() {
  const [
    messages,
    setMessages,
  ] =
    useState<ChatMessage[]>([
      {
        id: 1,
        role: "assistant",
        content:
          INITIAL_ASSISTANT_MESSAGE,
      },
    ]);

  const [
    requestId,
    setRequestId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    requestState,
    setRequestState,
  ] =
    useState<DocumentRequest | null>(
      null,
    );

  const [
    input,
    setInput,
  ] =
    useState("");

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(false);

  const [
    isRecoveringSession,
    setIsRecoveringSession,
  ] =
    useState(true);

  const [
    isDownloadingDocument,
    setIsDownloadingDocument,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isDegradedMode,
    setIsDegradedMode,
  ] =
    useState(false);

  const [
    degradedValidationErrors,
    setDegradedValidationErrors,
  ] =
    useState<string[]>([]);

  const [
    degradedForm,
    setDegradedForm,
  ] =
    useState<DegradedRequestForm>({
      documentType: "unknown",
      dni: "",
      accountId: "",
      loanId: "",
      movementId: "",
      dateFrom: "",
      dateTo: "",
    });

  const isReadyForConfirmation =
    requestState?.status ===
    "ready_for_confirmation";

  const isConfirmed =
    requestState?.status ===
    "confirmed";

  const isProcessing =
    requestState?.status ===
    "processing";

  const isPendingManualProcessing =
    requestState?.status ===
    "pending_manual_processing";

  const isManualProcessing =
    requestState?.status ===
    "manual_processing";

  const isCompleted =
    requestState?.status ===
    "completed";

  const isFailed =
    requestState?.status ===
    "failed";

  /*
   * Tipos de documento que actualmente
   * disponen de generación real de PDF,
   * almacenamiento en MinIO y descarga
   * desde Finora.
   */
  const hasDownloadableDocumentType =
    requestState?.documentType ===
      "account_statement" ||
    requestState?.documentType ===
      "loan_amortization" ||
    requestState?.documentType ===
      "swift_confirmation";

  const canDownloadDocument =
    Boolean(
      requestId &&
        isCompleted &&
        hasDownloadableDocumentType,
    );

  /*
   * Una vez que la solicitud entra
   * en procesamiento ya no seguimos
   * recopilando información por chat.
   */
  const isConversationClosed =
    isConfirmed ||
    isProcessing ||
    isPendingManualProcessing ||
    isManualProcessing ||
    isCompleted ||
    isFailed;

  /*
   * La cuenta no forma parte del
   * resumen operativo de un cuadro
   * de amortización.
   */
  const shouldShowAccount =
    requestState !== null &&
    requestState.documentType !==
      "loan_amortization" &&
    requestState.manualRequest ===
      null;

  /*
   * Mostramos el periodo únicamente:
   *
   * 1. si el motor lo considera
   *    pendiente, o
   * 2. si realmente existe una fecha.
   */
  const shouldShowPeriod =
    requestState !== null &&
    (
      requestState.missingFields.includes(
        "dateRange",
      ) ||
      (
        requestState.dateRange !==
          null &&
        (
          requestState.dateRange
            .from !== null ||
          requestState.dateRange
            .to !== null
        )
      )
    );

  const isDegradedCustomerResolved =
    requestState?.customer
      .resolutionStatus === "resolved";

  function synchronizeDegradedForm(
    state: DocumentRequest,
  ) {
    setDegradedForm(
      (current) => ({
        documentType:
          state.documentType !== "unknown"
            ? state.documentType
            : current.documentType,
        dni:
          state.customer.dni ??
          current.dni,
        accountId:
          state.selectedAccount?.accountId ??
          current.accountId,
        loanId:
          state.selectedLoan?.loanId ??
          current.loanId,
        movementId:
          state.selectedMovement?.movementId ??
          current.movementId,
        dateFrom:
          state.dateRange?.from ??
          current.dateFrom,
        dateTo:
          state.dateRange?.to ??
          current.dateTo,
      }),
    );
  }

  function activateDegradedMode(
    data: AgentApiResponse,
  ) {
    setIsDegradedMode(true);
    synchronizeDegradedForm(
      data.requestState,
    );
    setDegradedValidationErrors(
      data.validationErrors ??
        data.degradedMode
          ?.validationErrors ??
        [],
    );
  }

  function appendAssistantMessage(
    content: string,
  ) {
    setMessages(
      (currentMessages) => {
        const lastMessage =
          currentMessages[
            currentMessages.length -
              1
          ];

        if (
          lastMessage?.role ===
            "assistant" &&
          lastMessage.content ===
            content
        ) {
          return currentMessages;
        }

        return [
          ...currentMessages,
          {
            id: Date.now(),
            role:
              "assistant",
            content,
          },
        ];
      },
    );
  }

  function clearStoredRequestId() {
    window.localStorage.removeItem(
      ACTIVE_REQUEST_STORAGE_KEY,
    );
  }

  function storeRequestId(
    id: string,
  ) {
    window.localStorage.setItem(
      ACTIVE_REQUEST_STORAGE_KEY,
      id,
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function recoverSession() {
      const storedRequestId =
        window.localStorage.getItem(
          ACTIVE_REQUEST_STORAGE_KEY,
        );

      if (!storedRequestId) {
        if (!cancelled) {
          setIsRecoveringSession(
            false,
          );
        }

        return;
      }

      try {
        const response =
          await fetch(
            `/api/agent?requestId=${encodeURIComponent(
              storedRequestId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as
            | AgentApiResponse
            | AgentApiError;

        if (
          !response.ok ||
          "error" in data
        ) {
          const apiError =
            data as AgentApiError;

          if (
            apiError.code ===
            "SESSION_NOT_FOUND"
          ) {
            clearStoredRequestId();

            if (!cancelled) {
              setRequestId(
                null,
              );

              setRequestState(
                null,
              );
            }

            return;
          }

          throw new Error(
            apiError.error,
          );
        }

        if (cancelled) {
          return;
        }

        setRequestId(
          data.requestId,
        );

        setRequestState(
          data.requestState,
        );

        setMessages([
          {
            id:
              Date.now(),
            role:
              "assistant",
            content:
              "He recuperado tu solicitud anterior.",
          },
          {
            id:
              Date.now() + 1,
            role:
              "assistant",
            content:
              getRecoveryMessage(
                data.requestState,
                data.nextAction
                  .message,
              ),
          },
        ]);
      } catch (
        recoveryError
      ) {
        if (cancelled) {
          return;
        }

        const errorMessage =
          recoveryError instanceof
          Error
            ? recoveryError
                .message
            : "No se ha podido recuperar la solicitud anterior.";

        setError(
          errorMessage,
        );
      } finally {
        if (!cancelled) {
          setIsRecoveringSession(
            false,
          );
        }
      }
    }

    void recoverSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function sendAgentRequest(
    payload:
      | {
          message: string;
          requestId:
            string | null;
        }
      | {
          action:
            "confirm_request";
          requestId: string;
        }
      | {
          action:
            "submit_degraded_request";
          requestId: string;
          degradedRequest: {
            documentType: DocumentType;
            dni: string;
            accountId: string | null;
            loanId: string | null;
            movementId: string | null;
            dateFrom: string | null;
            dateTo: string | null;
          };
        },
  ): Promise<AgentApiResponse> {
    const response =
      await fetch(
        "/api/agent",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload,
            ),
        },
      );

    const data =
      (await response.json()) as
        | AgentApiResponse
        | AgentApiError;

    if (
      !response.ok ||
      "error" in data
    ) {
      const apiError =
        data as AgentApiError;

      if (
        apiError.code ===
        "SESSION_NOT_FOUND"
      ) {
        clearStoredRequestId();

        setRequestId(
          null,
        );

        setRequestState(
          null,
        );
      }

      throw new Error(
        apiError.error,
      );
    }

    return data;
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const message =
      input.trim();

    if (
      !message ||
      isLoading ||
      isRecoveringSession ||
      isConversationClosed
    ) {
      return;
    }

    const userMessage:
      ChatMessage = {
      id: Date.now(),
      role: "user",
      content: message,
    };

    setMessages(
      (
        currentMessages,
      ) => [
        ...currentMessages,
        userMessage,
      ],
    );

    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const data =
        await sendAgentRequest(
          {
            message,
            requestId,
          },
        );

      setRequestId(
        data.requestId,
      );

      storeRequestId(
        data.requestId,
      );

      setRequestState(
        data.requestState,
      );

      if (
        data.nextAction.type ===
          "ai_degraded_mode" ||
        data.agent.mode ===
          "degraded"
      ) {
        activateDegradedMode(
          data,
        );
      }

      appendAssistantMessage(
        data.nextAction.message,
      );
    } catch (
      requestError
    ) {
      const errorMessage =
        requestError instanceof
        Error
          ? requestError
              .message
          : "Se ha producido un error inesperado.";

      setError(
        errorMessage,
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDegradedSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !requestId ||
      isLoading
    ) {
      return;
    }

    setError(null);
    setDegradedValidationErrors([]);
    setIsLoading(true);

    try {
      const data =
        await sendAgentRequest(
          {
            action:
              "submit_degraded_request",
            requestId,
            degradedRequest: {
              documentType:
                degradedForm.documentType,
              dni:
                degradedForm.dni
                  .trim()
                  .toUpperCase(),
              accountId:
                degradedForm.accountId ||
                null,
              loanId:
                degradedForm.loanId ||
                null,
              movementId:
                degradedForm.movementId ||
                null,
              dateFrom:
                degradedForm.dateFrom ||
                null,
              dateTo:
                degradedForm.dateTo ||
                null,
            },
          },
        );

      setRequestState(
        data.requestState,
      );

      synchronizeDegradedForm(
        data.requestState,
      );

      const validationErrors =
        data.validationErrors ??
        data.degradedMode
          ?.validationErrors ??
        [];

      setDegradedValidationErrors(
        validationErrors,
      );

      if (
        data.requestState.status ===
          "ready_for_confirmation"
      ) {
        setIsDegradedMode(
          false,
        );
      }

      appendAssistantMessage(
        validationErrors.length > 0
          ? "Revisa los datos del modo de contingencia. Hay información que todavía no es válida o está pendiente."
          : data.nextAction.message,
      );
    } catch (
      requestError
    ) {
      const errorMessage =
        requestError instanceof
        Error
          ? requestError.message
          : "Se ha producido un error inesperado.";

      setError(
        errorMessage,
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmRequest() {
    if (
      !requestId ||
      !requestState ||
      requestState.status !==
        "ready_for_confirmation" ||
      isLoading
    ) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const data =
        await sendAgentRequest(
          {
            action:
              "confirm_request",
            requestId,
          },
        );

      setRequestState(
        data.requestState,
      );

      appendAssistantMessage(
        data.nextAction.message,
      );
    } catch (
      requestError
    ) {
      const errorMessage =
        requestError instanceof
        Error
          ? requestError
              .message
          : "Se ha producido un error inesperado.";

      setError(
        errorMessage,
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownloadDocument() {
    if (
      !requestId ||
      !requestState ||
      !canDownloadDocument ||
      isDownloadingDocument
    ) {
      return;
    }

    setError(null);

    setIsDownloadingDocument(
      true,
    );

    try {
      const response =
        await fetch(
          `/api/documents/${encodeURIComponent(
            requestId,
          )}/download`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        let errorMessage =
          "No se ha podido descargar el documento.";

        try {
          const apiError =
            (await response.json()) as
              AgentApiError;

          if (
            apiError.error
          ) {
            errorMessage =
              apiError.error;
          }
        } catch {
          /*
           * Si la respuesta de error no
           * es JSON conservamos el
           * mensaje genérico.
           */
        }

        throw new Error(
          errorMessage,
        );
      }

      const blob =
        await response.blob();

      const contentDisposition =
        response.headers.get(
          "Content-Disposition",
        );

      const fileNameMatch =
        contentDisposition?.match(
          /filename="([^"]+)"/,
        );

      const fileName =
        fileNameMatch?.[1] ??
        getDefaultPdfFileName(
          requestState.documentType,
          requestId,
        );

      const downloadUrl =
        window.URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href =
        downloadUrl;

      anchor.download =
        fileName;

      document.body.appendChild(
        anchor,
      );

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(
        downloadUrl,
      );
    } catch (
      downloadError
    ) {
      const errorMessage =
        downloadError instanceof
        Error
          ? downloadError
              .message
          : "No se ha podido descargar el documento.";

      setError(
        errorMessage,
      );
    } finally {
      setIsDownloadingDocument(
        false,
      );
    }
  }

  function resetConversation() {
    clearStoredRequestId();

    setRequestId(
      null,
    );

    setRequestState(
      null,
    );

    setMessages([
      {
        id: Date.now(),
        role:
          "assistant",
        content:
          INITIAL_ASSISTANT_MESSAGE,
      },
    ]);

    setInput("");
    setError(null);
    setIsDegradedMode(false);
    setDegradedValidationErrors([]);
    setDegradedForm({
      documentType: "unknown",
      dni: "",
      accountId: "",
      loanId: "",
      movementId: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  return (
    <main className="min-h-screen bg-[#020817] px-5 py-10 text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-[720px] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60">
          <header className="border-b border-slate-800 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-emerald-400">
                  Finora Docs AI
                </p>

                <h1 className="mt-1 text-2xl font-semibold">
                  Solicitud de documentos
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Cuéntame qué necesitas con tus propias palabras.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  resetConversation
                }
                disabled={
                  isRecoveringSession
                }
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Nueva solicitud
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-8">
            {messages.map(
              (message) => (
                <div
                  key={
                    message.id
                  }
                  className={`flex ${
                    message.role ===
                    "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-5 py-4 text-[15px] leading-7 ${
                      message.role ===
                      "user"
                        ? "bg-emerald-500 text-slate-950"
                        : "border border-slate-800 bg-slate-900 text-slate-100"
                    }`}
                  >
                    {
                      message.content
                    }
                  </div>
                </div>
              ),
            )}

            {isRecoveringSession && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-sm text-slate-400">
                  Recuperando la solicitud activa...
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-sm text-slate-400">
                  Finora está procesando tu solicitud...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 p-5">
            {error && (
              <div className="mb-4 rounded-xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {isReadyForConfirmation && (
              <div className="mb-4 rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-4">
                <p className="text-sm text-emerald-200">
                  {requestState?.manualRequest
                    ? "Finora ha identificado el documento y los datos del cliente. Esta solicitud requerirá tramitación manual."
                    : "Finora ha recopilado toda la información necesaria."}
                </p>

                <button
                  type="button"
                  onClick={
                    handleConfirmRequest
                  }
                  disabled={
                    isLoading
                  }
                  className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirmar solicitud
                </button>
              </div>
            )}

            {isConfirmed && (
              <div className="rounded-2xl border border-emerald-800/70 bg-emerald-950/30 px-5 py-4">
                <p className="font-medium text-emerald-300">
                  Solicitud confirmada
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  La solicitud está preparada para iniciar su procesamiento.
                </p>
              </div>
            )}

            {isProcessing && (
              <div className="rounded-2xl border border-sky-900/70 bg-sky-950/30 px-5 py-4">
                <p className="font-medium text-sky-300">
                  Solicitud en procesamiento
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Finora está procesando la solicitud y preparando el documento.
                </p>
              </div>
            )}

            {isPendingManualProcessing && (
              <div className="rounded-2xl border border-amber-800/70 bg-amber-950/20 px-5 py-4">
                <p className="font-medium text-amber-200">
                  Pendiente de tramitación manual
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  La solicitud ha sido registrada correctamente. Un gestor deberá tramitar el documento antes de que pueda quedar disponible para el cliente.
                </p>
              </div>
            )}

            {isManualProcessing && (
              <div className="rounded-2xl border border-sky-900/70 bg-sky-950/30 px-5 py-4">
                <p className="font-medium text-sky-300">
                  Solicitud en tramitación manual
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Un gestor está tramitando esta solicitud. El documento se incorporará a Finora cuando finalice la gestión.
                </p>
              </div>
            )}

            {isCompleted && (
              <div className="rounded-2xl border border-emerald-800/70 bg-emerald-950/30 px-5 py-4">
                <p className="font-medium text-emerald-300">
                  Solicitud completada
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  El procesamiento ha finalizado correctamente y el documento está preparado.
                </p>

                {canDownloadDocument && (
                  <button
                    type="button"
                    onClick={
                      handleDownloadDocument
                    }
                    disabled={
                      isDownloadingDocument
                    }
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDownloadingDocument
                      ? "Preparando descarga..."
                      : "Descargar PDF"}
                  </button>
                )}
              </div>
            )}

            {isFailed && (
              <div className="rounded-2xl border border-red-900/70 bg-red-950/30 px-5 py-4">
                <p className="font-medium text-red-300">
                  Error de procesamiento
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  La solicitud fue registrada, pero no pudo completarse correctamente.
                </p>
              </div>
            )}

            {!isConversationClosed && isDegradedMode && (
              <div className="mb-4 rounded-2xl border border-amber-800/70 bg-amber-950/20 p-5">
                <p className="font-medium text-amber-200">
                  Modo de contingencia
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  La interpretación automática no está disponible. Introduce los datos de forma estructurada; Finora los validará en el servidor antes de continuar.
                </p>

                {degradedValidationErrors.length > 0 && (
                  <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3">
                    {degradedValidationErrors.map(
                      (validationError) => (
                        <p
                          key={validationError}
                          className="text-sm text-red-300"
                        >
                          {validationError}
                        </p>
                      ),
                    )}
                  </div>
                )}

                <form
                  onSubmit={handleDegradedSubmit}
                  className="mt-5 grid gap-4 md:grid-cols-2"
                >
                  <label className="text-sm text-slate-300">
                    Tipo de documento
                    <select
                      value={degradedForm.documentType}
                      onChange={(event) =>
                        setDegradedForm((current) => ({
                          ...current,
                          documentType:
                            event.target.value as DocumentType,
                          accountId: "",
                          loanId: "",
                          movementId: "",
                        }))
                      }
                      disabled={isLoading}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-500"
                    >
                      <option value="unknown">
                        Selecciona un documento
                      </option>
                      <option value="account_statement">
                        Extracto de cuenta
                      </option>
                      <option value="position_statement">
                        Estado de posición
                      </option>
                      <option value="loan_amortization">
                        Cuadro de amortización
                      </option>
                      <option value="swift_confirmation">
                        Confirmación SWIFT
                      </option>
                    </select>
                  </label>

                  <label className="text-sm text-slate-300">
                    DNI
                    <input
                      value={degradedForm.dni}
                      onChange={(event) =>
                        setDegradedForm((current) => ({
                          ...current,
                          dni: event.target.value.toUpperCase(),
                        }))
                      }
                      disabled={isLoading}
                      placeholder="12345678A"
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-amber-500"
                    />
                  </label>

                  {isDegradedCustomerResolved &&
                    (degradedForm.documentType === "account_statement" ||
                      degradedForm.documentType === "position_statement" ||
                      degradedForm.documentType === "swift_confirmation") && (
                    <label className="text-sm text-slate-300">
                      Cuenta
                      <select
                        value={degradedForm.accountId}
                        onChange={(event) =>
                          setDegradedForm((current) => ({
                            ...current,
                            accountId: event.target.value,
                            movementId: "",
                          }))
                        }
                        disabled={isLoading}
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-500"
                      >
                        <option value="">
                          Selecciona una cuenta
                        </option>
                        {requestState?.availableAccounts.map(
                          (account) => (
                            <option
                              key={account.accountId}
                              value={account.accountId}
                            >
                              {account.accountName} {account.maskedAccountNumber}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}

                  {isDegradedCustomerResolved &&
                    degradedForm.documentType === "loan_amortization" && (
                    <label className="text-sm text-slate-300">
                      Préstamo
                      <select
                        value={degradedForm.loanId}
                        onChange={(event) =>
                          setDegradedForm((current) => ({
                            ...current,
                            loanId: event.target.value,
                          }))
                        }
                        disabled={isLoading}
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-500"
                      >
                        <option value="">
                          Selecciona un préstamo
                        </option>
                        {requestState?.availableLoans.map(
                          (loan) => (
                            <option
                              key={loan.loanId}
                              value={loan.loanId}
                            >
                              {loan.loanName} {loan.maskedLoanNumber}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}

                  {isDegradedCustomerResolved &&
                    degradedForm.documentType === "swift_confirmation" && (
                    <label className="text-sm text-slate-300 md:col-span-2">
                      Operación SWIFT
                      <select
                        value={degradedForm.movementId}
                        onChange={(event) =>
                          setDegradedForm((current) => ({
                            ...current,
                            movementId: event.target.value,
                          }))
                        }
                        disabled={isLoading || !degradedForm.accountId}
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-500 disabled:opacity-50"
                      >
                        <option value="">
                          Selecciona una operación
                        </option>
                        {requestState?.availableMovements
                          .filter(
                            (movement) =>
                              !degradedForm.accountId ||
                              movement.accountId === degradedForm.accountId,
                          )
                          .filter(
                            (movement) =>
                              movement.swiftDetails != null,
                          )
                          .map(
                            (movement) => (
                              <option
                                key={movement.movementId}
                                value={movement.movementId}
                              >
                                {movement.date} · {movement.description} · {movement.amount} {movement.currency}
                              </option>
                            ),
                          )}
                      </select>
                    </label>
                  )}

                  {isDegradedCustomerResolved &&
                    (degradedForm.documentType === "account_statement" ||
                      degradedForm.documentType === "position_statement") && (
                    <>
                      <label className="text-sm text-slate-300">
                        Fecha inicial
                        <input
                          type="date"
                          value={degradedForm.dateFrom}
                          onChange={(event) =>
                            setDegradedForm((current) => ({
                              ...current,
                              dateFrom: event.target.value,
                            }))
                          }
                          disabled={isLoading}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-500"
                        />
                      </label>

                      <label className="text-sm text-slate-300">
                        Fecha final
                        <input
                          type="date"
                          value={degradedForm.dateTo}
                          onChange={(event) =>
                            setDegradedForm((current) => ({
                              ...current,
                              dateTo: event.target.value,
                            }))
                          }
                          disabled={isLoading}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-500"
                        />
                      </label>
                    </>
                  )}

                  <div className="md:col-span-2">
                    {!isDegradedCustomerResolved ? (
                      <div>
                        <p className="mb-3 text-sm leading-6 text-slate-400">
                          Primero identificaremos al cliente con el DNI. Las cuentas, préstamos y operaciones disponibles se cargarán desde los datos bancarios del servidor.
                        </p>

                        <button
                          type="submit"
                          disabled={
                            isLoading ||
                            degradedForm.documentType === "unknown" ||
                            !degradedForm.dni.trim()
                          }
                          className="rounded-xl bg-amber-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isLoading
                            ? "Identificando cliente..."
                            : "Identificar cliente"}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-4 rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3">
                          <p className="text-sm font-medium text-emerald-300">
                            Cliente identificado
                          </p>

                          <p className="mt-1 text-sm text-slate-300">
                            {requestState?.customer.name}
                            {requestState?.customer.dni
                              ? ` · DNI ${requestState.customer.dni}`
                              : ""}
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={
                            isLoading ||
                            degradedForm.documentType === "unknown" ||
                            !degradedForm.dni.trim()
                          }
                          className="rounded-xl bg-amber-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isLoading
                            ? "Validando datos..."
                            : "Validar datos y continuar"}
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              </div>
            )}

            {!isConversationClosed && !isDegradedMode && (
              <form
                onSubmit={
                  handleSubmit
                }
                className="flex gap-3"
              >
                <input
                  value={
                    input
                  }
                  onChange={(
                    event,
                  ) =>
                    setInput(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    isLoading ||
                    isRecoveringSession
                  }
                  placeholder={
                    isRecoveringSession
                      ? "Recuperando solicitud..."
                      : isReadyForConfirmation
                        ? "Puedes confirmar o indicarme cualquier cambio..."
                        : "Escribe tu mensaje..."
                  }
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500 disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    isRecoveringSession ||
                    !input.trim()
                  }
                  className="rounded-2xl bg-emerald-500 px-6 py-4 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Enviar
                </button>
              </form>
            )}
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Solicitud actual
          </p>

          {!requestState ? (
            <p className="mt-5 text-sm leading-6 text-slate-500">
              {isRecoveringSession
                ? "Comprobando si existe una solicitud activa..."
                : "La información aparecerá aquí a medida que Finora entienda tu solicitud."}
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-xs text-slate-500">
                  Documento
                </p>

                <p className="mt-1 font-medium">
                  {requestState.manualRequest
                    ?.requestedDocumentDescription ??
                    documentTypeLabels[
                      requestState
                        .documentType
                    ]}
                </p>

                {requestState.manualRequest && (
                  <p className="mt-1 text-xs text-amber-300">
                    Tramitación manual
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Cliente
                </p>

                <p className="mt-1 font-medium">
                  {requestState.customer
                    .name ??
                    (requestState
                      .customer
                      .resolutionStatus ===
                    "not_found"
                      ? "Cliente no encontrado"
                      : "Pendiente de identificar")}
                </p>

                {requestState
                  .customer.dni && (
                  <p className="mt-1 text-sm text-slate-400">
                    DNI{" "}
                    {
                      requestState
                        .customer
                        .dni
                    }
                  </p>
                )}
              </div>

              {shouldShowAccount && (
                <div>
                  <p className="text-xs text-slate-500">
                    Cuenta
                  </p>

                  <p className="mt-1 font-medium">
                    {requestState
                      .selectedAccount
                      ? `${requestState.selectedAccount.accountName} ${requestState.selectedAccount.maskedAccountNumber}`
                      : "Pendiente"}
                  </p>
                </div>
              )}

              {requestState
                .documentType ===
                "loan_amortization" && (
                <div>
                  <p className="text-xs text-slate-500">
                    Préstamo
                  </p>

                  <p className="mt-1 font-medium">
                    {requestState
                      .selectedLoan
                      ? `${requestState.selectedLoan.loanName} ${requestState.selectedLoan.maskedLoanNumber}`
                      : "Pendiente"}
                  </p>
                </div>
              )}

              {requestState
                .documentType ===
                "swift_confirmation" && (
                <div>
                  <p className="text-xs text-slate-500">
                    Operación
                  </p>

                  <p className="mt-1 font-medium">
                    {requestState
                      .selectedMovement
                      ? `${requestState.selectedMovement.date} · ${requestState.selectedMovement.amount} ${requestState.selectedMovement.currency}`
                      : "Pendiente"}
                  </p>
                </div>
              )}

              {shouldShowPeriod && (
                <div>
                  <p className="text-xs text-slate-500">
                    Periodo
                  </p>

                  <p className="mt-1 font-medium">
                    {requestState
                      .dateRange
                      ?.from &&
                    requestState
                      .dateRange
                      ?.to
                      ? `${requestState.dateRange.from} → ${requestState.dateRange.to}`
                      : "Pendiente"}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500">
                  Estado
                </p>

                <p
                  className={`mt-1 font-medium ${
                    requestState
                      .status ===
                    "failed"
                      ? "text-red-300"
                      : requestState
                            .status ===
                          "processing" ||
                          requestState
                            .status ===
                          "manual_processing"
                        ? "text-sky-300"
                        : requestState
                              .status ===
                            "pending_manual_processing"
                          ? "text-amber-300"
                          : "text-emerald-400"
                  }`}
                >
                  {getStatusLabel(
                    requestState
                      .status,
                  )}
                </p>
              </div>

              {requestState
                .missingFields
                .length > 0 &&
                requestState
                  .status ===
                  "collecting_information" && (
                  <div>
                    <p className="text-xs text-slate-500">
                      Información pendiente
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {requestState
                        .missingFields
                        .map(
                          (
                            field,
                          ) => (
                            <span
                              key={
                                field
                              }
                              className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-2.5 py-1.5 text-xs text-amber-300"
                            >
                              {missingFieldLabels[
                                field
                              ] ??
                                field}
                            </span>
                          ),
                        )}
                    </div>
                  </div>
                )}

              {requestId && (
                <div className="border-t border-slate-800 pt-5">
                  <p className="text-xs text-slate-600">
                    Sesión de solicitud activa
                  </p>

                  <p className="mt-1 truncate font-mono text-[11px] text-slate-700">
                    {
                      requestId
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
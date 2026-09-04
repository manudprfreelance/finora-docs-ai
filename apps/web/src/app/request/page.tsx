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

  requestState: DocumentRequest;

  nextAction: {
    type: string;
    message: string;
  };
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
  unknown: "Sin identificar",
};

const missingFieldLabels: Record<
  string,
  string
> = {
  dni: "DNI",
  customer: "Cliente",
  documentType:
    "Tipo de documento",
  account: "Cuenta",
  dateRange: "Periodo",
  loan: "Préstamo",
  movement: "Operación",
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

export default function RequestPage() {
  const [messages, setMessages] =
    useState<ChatMessage[]>([
      {
        id: 1,
        role: "assistant",
        content:
          INITIAL_ASSISTANT_MESSAGE,
      },
    ]);

  const [requestId, setRequestId] =
    useState<string | null>(null);

  const [
    requestState,
    setRequestState,
  ] =
    useState<DocumentRequest | null>(
      null,
    );

  const [input, setInput] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    isRecoveringSession,
    setIsRecoveringSession,
  ] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const isReadyForConfirmation =
    requestState?.status ===
    "ready_for_confirmation";

  const isConfirmed =
    requestState?.status ===
    "confirmed";

  const isProcessing =
    requestState?.status ===
    "processing";

  const isCompleted =
    requestState?.status ===
    "completed";

  const isFailed =
    requestState?.status ===
    "failed";

  /*
   * Una vez que la solicitud entra en su
   * fase de procesamiento ya no seguimos
   * recopilando información mediante chat.
   */
  const isConversationClosed =
    isConfirmed ||
    isProcessing ||
    isCompleted ||
    isFailed;

  /*
   * La cuenta no forma parte del resumen
   * operativo de un cuadro de amortización.
   */
  const shouldShowAccount =
    requestState !== null &&
    requestState.documentType !==
      "loan_amortization";

  /*
   * Mostramos el periodo únicamente:
   *
   * 1. si el motor lo considera pendiente, o
   * 2. si realmente existe alguna fecha.
   */
  const shouldShowPeriod =
    requestState !== null &&
    (
      requestState.missingFields.includes(
        "dateRange",
      ) ||
      (
        requestState.dateRange !== null &&
        (
          requestState.dateRange.from !==
            null ||
          requestState.dateRange.to !==
            null
        )
      )
    );

  function appendAssistantMessage(
    content: string,
  ) {
    setMessages(
      (currentMessages) => {
        const lastMessage =
          currentMessages[
            currentMessages.length - 1
          ];

        if (
          lastMessage?.role ===
            "assistant" &&
          lastMessage.content === content
        ) {
          return currentMessages;
        }

        return [
          ...currentMessages,
          {
            id: Date.now(),
            role: "assistant",
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
          setIsRecoveringSession(false);
        }

        return;
      }

      try {
        const response = await fetch(
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
              setRequestId(null);
              setRequestState(null);
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
            id: Date.now(),
            role: "assistant",
            content:
              "He recuperado tu solicitud anterior.",
          },
          {
            id: Date.now() + 1,
            role: "assistant",
            content:
              getRecoveryMessage(
                data.requestState,
                data.nextAction.message,
              ),
          },
        ]);
      } catch (recoveryError) {
        if (cancelled) {
          return;
        }

        const errorMessage =
          recoveryError instanceof Error
            ? recoveryError.message
            : "No se ha podido recuperar la solicitud anterior.";

        setError(errorMessage);
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
          requestId: string | null;
        }
      | {
          action:
            "confirm_request";
          requestId: string;
        },
  ): Promise<AgentApiResponse> {
    const response = await fetch(
      "/api/agent",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
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

        setRequestId(null);
        setRequestState(null);
      }

      throw new Error(
        apiError.error,
      );
    }

    return data;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const message = input.trim();

    if (
      !message ||
      isLoading ||
      isRecoveringSession ||
      isConversationClosed
    ) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: message,
    };

    setMessages(
      (currentMessages) => [
        ...currentMessages,
        userMessage,
      ],
    );

    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const data =
        await sendAgentRequest({
          message,
          requestId,
        });

      setRequestId(
        data.requestId,
      );

      storeRequestId(
        data.requestId,
      );

      setRequestState(
        data.requestState,
      );

      appendAssistantMessage(
        data.nextAction.message,
      );
    } catch (requestError) {
      const errorMessage =
        requestError instanceof Error
          ? requestError.message
          : "Se ha producido un error inesperado.";

      setError(errorMessage);
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
        await sendAgentRequest({
          action:
            "confirm_request",
          requestId,
        });

      setRequestState(
        data.requestState,
      );

      appendAssistantMessage(
        data.nextAction.message,
      );
    } catch (requestError) {
      const errorMessage =
        requestError instanceof Error
          ? requestError.message
          : "Se ha producido un error inesperado.";

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  function resetConversation() {
    clearStoredRequestId();

    setRequestId(null);

    setRequestState(null);

    setMessages([
      {
        id: Date.now(),
        role: "assistant",
        content:
          INITIAL_ASSISTANT_MESSAGE,
      },
    ]);

    setInput("");
    setError(null);
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
                  key={message.id}
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
                  Finora ha recopilado toda la información necesaria.
                </p>

                <button
                  type="button"
                  onClick={
                    handleConfirmRequest
                  }
                  disabled={isLoading}
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

            {isCompleted && (
              <div className="rounded-2xl border border-emerald-800/70 bg-emerald-950/30 px-5 py-4">
                <p className="font-medium text-emerald-300">
                  Solicitud completada
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  El procesamiento ha finalizado correctamente y el documento está preparado.
                </p>
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

            {!isConversationClosed && (
              <form
                onSubmit={
                  handleSubmit
                }
                className="flex gap-3"
              >
                <input
                  value={input}
                  onChange={(event) =>
                    setInput(
                      event.target.value,
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
                  {
                    documentTypeLabels[
                      requestState.documentType
                    ]
                  }
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Cliente
                </p>

                <p className="mt-1 font-medium">
                  {requestState.customer.name ??
                    (requestState.customer
                      .resolutionStatus ===
                    "not_found"
                      ? "Cliente no encontrado"
                      : "Pendiente de identificar")}
                </p>

                {requestState.customer.dni && (
                  <p className="mt-1 text-sm text-slate-400">
                    DNI{" "}
                    {
                      requestState.customer
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
                    {requestState.selectedAccount
                      ? `${requestState.selectedAccount.accountName} ${requestState.selectedAccount.maskedAccountNumber}`
                      : "Pendiente"}
                  </p>
                </div>
              )}

              {requestState.documentType ===
                "loan_amortization" && (
                <div>
                  <p className="text-xs text-slate-500">
                    Préstamo
                  </p>

                  <p className="mt-1 font-medium">
                    {requestState.selectedLoan
                      ? `${requestState.selectedLoan.loanName} ${requestState.selectedLoan.maskedLoanNumber}`
                      : "Pendiente"}
                  </p>
                </div>
              )}

              {requestState.documentType ===
                "swift_confirmation" && (
                <div>
                  <p className="text-xs text-slate-500">
                    Operación
                  </p>

                  <p className="mt-1 font-medium">
                    {requestState.selectedMovement
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
                    {requestState.dateRange?.from &&
                    requestState.dateRange?.to
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
                    requestState.status ===
                    "failed"
                      ? "text-red-300"
                      : requestState.status ===
                          "processing"
                        ? "text-sky-300"
                        : "text-emerald-400"
                  }`}
                >
                  {getStatusLabel(
                    requestState.status,
                  )}
                </p>
              </div>

              {requestState.missingFields
                .length > 0 &&
                requestState.status ===
                  "collecting_information" && (
                  <div>
                    <p className="text-xs text-slate-500">
                      Información pendiente
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {requestState.missingFields.map(
                        (field) => (
                          <span
                            key={field}
                            className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-2.5 py-1.5 text-xs text-amber-300"
                          >
                            {missingFieldLabels[
                              field
                            ] ?? field}
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
                    {requestId}
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
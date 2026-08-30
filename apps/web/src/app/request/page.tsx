"use client";

import { FormEvent, useState } from "react";

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

const documentTypeLabels: Record<DocumentType, string> = {
  account_statement: "Extracto de cuenta",
  position_statement: "Estado de posición",
  loan_amortization: "Cuadro de amortización",
  swift_confirmation: "Confirmación SWIFT",
  unknown: "Sin identificar",
};

const missingFieldLabels: Record<string, string> = {
  dni: "DNI",
  customer: "Cliente",
  documentType: "Tipo de documento",
  account: "Cuenta",
  dateRange: "Periodo",
  loan: "Préstamo",
  movement: "Operación",
};

export default function RequestPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Hola, soy Finora. Dime qué documento bancario necesitas y te ayudaré a solicitarlo.",
    },
  ]);

  /*
   * The browser keeps only the opaque request identifier.
   * The authoritative DocumentRequest lives on the server.
   */
  const [requestId, setRequestId] =
    useState<string | null>(null);

  /*
   * This copy exists only for rendering the current state.
   * It is never sent back as the source of truth.
   */
  const [requestState, setRequestState] =
    useState<DocumentRequest | null>(null);

  const [input, setInput] = useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const isConfirmed =
    requestState?.status === "confirmed";

  const isReadyForConfirmation =
    requestState?.status ===
    "ready_for_confirmation";

  function appendAssistantMessage(
    content: string,
  ) {
    setMessages((currentMessages) => {
      const lastMessage =
        currentMessages[
          currentMessages.length - 1
        ];

      if (
        lastMessage?.role === "assistant" &&
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
    });
  }

  async function sendAgentRequest(
    payload:
      | {
          message: string;
          requestId: string | null;
        }
      | {
          action: "confirm_request";
          requestId: string;
        },
  ): Promise<AgentApiResponse> {
    const response = await fetch(
      "/api/agent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      },
    );

    const data = (await response.json()) as
      | AgentApiResponse
      | AgentApiError;

    if (!response.ok || "error" in data) {
      const apiError =
        data as AgentApiError;

      if (
        apiError.code ===
        "SESSION_NOT_FOUND"
      ) {
        setRequestId(null);
        setRequestState(null);
      }

      throw new Error(apiError.error);
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
      isConfirmed
    ) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: message,
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
    ]);

    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const data =
        await sendAgentRequest({
          message,
          requestId,
        });

      /*
       * requestId is created by the server on
       * the first message and reused afterwards.
       */
      setRequestId(data.requestId);

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
          action: "confirm_request",
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
    /*
     * A new request does not reuse the previous requestId.
     * The next customer message will create a fresh
     * server-side session.
     */
    setRequestId(null);

    setRequestState(null);

    setMessages([
      {
        id: Date.now(),
        role: "assistant",
        content:
          "Hola, soy Finora. Dime qué documento bancario necesitas y te ayudaré a solicitarlo.",
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
                onClick={resetConversation}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Nueva solicitud
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-5 py-4 text-[15px] leading-7 ${
                    message.role === "user"
                      ? "bg-emerald-500 text-slate-950"
                      : "border border-slate-800 bg-slate-900 text-slate-100"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

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
                  onClick={handleConfirmRequest}
                  disabled={isLoading}
                  className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirmar solicitud
                </button>
              </div>
            )}

            {isConfirmed ? (
              <div className="rounded-2xl border border-emerald-800/70 bg-emerald-950/30 px-5 py-4">
                <p className="font-medium text-emerald-300">
                  Solicitud confirmada
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Esta solicitud ya está preparada para su procesamiento.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex gap-3"
              >
                <input
                  value={input}
                  onChange={(event) =>
                    setInput(
                      event.target.value,
                    )
                  }
                  disabled={isLoading}
                  placeholder={
                    isReadyForConfirmation
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
              La información aparecerá aquí a medida que Finora entienda tu solicitud.
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
                      requestState
                        .customer.dni
                    }
                  </p>
                )}
              </div>

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

              <div>
                <p className="text-xs text-slate-500">
                  Periodo
                </p>

                <p className="mt-1 font-medium">
                  {requestState.dateRange
                    ?.from &&
                  requestState.dateRange?.to
                    ? `${requestState.dateRange.from} → ${requestState.dateRange.to}`
                    : "Pendiente"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Estado
                </p>

                <p
                  className={`mt-1 font-medium ${
                    requestState.status ===
                    "confirmed"
                      ? "text-emerald-300"
                      : "text-emerald-400"
                  }`}
                >
                  {requestState.status ===
                  "confirmed"
                    ? "Confirmada"
                    : requestState.status ===
                        "ready_for_confirmation"
                      ? "Lista para confirmar"
                      : "Recopilando información"}
                </p>
              </div>

              {requestState.missingFields
                .length > 0 && (
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
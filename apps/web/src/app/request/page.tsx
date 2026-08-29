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
  receivedMessage: string;

  agent: {
    mode: string;
    provider: string;
    model: string;
  };

  requestState: DocumentRequest;

  nextAction: {
    type: string;
    message: string;
  };
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
  name: "Nombre",
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

  const [input, setInput] = useState("");

  const [requestState, setRequestState] =
    useState<DocumentRequest | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const message = input.trim();

    if (!message || isLoading) {
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
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          requestState,
        }),
      });

      const data = (await response.json()) as
        | AgentApiResponse
        | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error(
          "error" in data
            ? data.error
            : "No se ha podido procesar la solicitud.",
        );
      }

      setRequestState(data.requestState);

      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.nextAction.message,
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantMessage,
      ]);
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
    setMessages([
      {
        id: Date.now(),
        role: "assistant",
        content:
          "Hola, soy Finora. Dime qué documento bancario necesitas y te ayudaré a solicitarlo.",
      },
    ]);

    setRequestState(null);
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

            <form
              onSubmit={handleSubmit}
              className="flex gap-3"
            >
              <input
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                disabled={isLoading}
                placeholder="Escribe tu mensaje..."
                autoComplete="off"
                className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500 disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-2xl bg-emerald-500 px-6 py-4 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Enviar
              </button>
            </form>
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
                    "Pendiente de identificar"}
                </p>

                {requestState.customer.dni && (
                  <p className="mt-1 text-sm text-slate-400">
                    DNI {requestState.customer.dni}
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
                  {requestState.dateRange?.from &&
                  requestState.dateRange?.to
                    ? `${requestState.dateRange.from} → ${requestState.dateRange.to}`
                    : "Pendiente"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Estado
                </p>

                <p className="mt-1 font-medium text-emerald-400">
                  {requestState.status ===
                  "ready_for_confirmation"
                    ? "Lista para confirmar"
                    : "Recopilando información"}
                </p>
              </div>

              {requestState.missingFields.length > 0 && (
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
                          {missingFieldLabels[field] ??
                            field}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
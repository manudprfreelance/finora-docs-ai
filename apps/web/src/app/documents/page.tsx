"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

interface CustomerDocument {
  requestId: string;
  documentType: string;
  documentName: string;
  status: string;
  processingMode:
    | "automatic"
    | "manual";
  createdAt: string;
  updatedAt: string;
  downloadAvailable: boolean;
}

interface DocumentsResponse {
  customerId: string;
  documents: CustomerDocument[];
  total: number;
}

interface CancellationResponse {
  requestId?: string;
  status?: string;
  cancelled?: boolean;
  duplicatePrevented?: boolean;
  error?: string;
  code?: string;
}

const CUSTOMER_ID = "customer-001";

const CANCELLABLE_STATUSES = new Set([
  "collecting_information",
  "ready_for_confirmation",
  "confirmed",
  "pending_manual_processing",
]);

function getDocumentName(
  document: CustomerDocument,
) {
  switch (document.documentType) {
    case "account_statement":
      return "Extracto de cuenta";

    case "loan_amortization":
      return "Cuadro de amortización";

    case "swift_confirmation":
      return "Justificante SWIFT";

    case "position_statement":
      return "Certificado de posiciones";

    default:
      return (
        document.documentName ||
        "Documento bancario"
      );
  }
}

function getStatusLabel(
  status: string,
) {
  switch (status) {
    case "completed":
      return "Disponible";

    case "processing":
      return "Procesando";

    case "manual_processing":
      return "En tramitación manual";

    case "pending_manual_processing":
      return "Pendiente de gestión manual";

    case "confirmed":
      return "Confirmada";

    case "ready_for_confirmation":
      return "Pendiente de confirmación";

    case "collecting_information":
      return "Solicitud incompleta";

    case "failed":
      return "Error de procesamiento";

    case "cancelled":
      return "Anulada";

    default:
      return status;
  }
}

function getStatusClasses(
  status: string,
) {
  switch (status) {
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "processing":
    case "manual_processing":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";

    case "pending_manual_processing":
    case "confirmed":
    case "ready_for_confirmation":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "failed":
    case "cancelled":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function getDocumentIcon(
  documentType: string,
) {
  switch (documentType) {
    case "account_statement":
      return "EC";

    case "loan_amortization":
      return "CA";

    case "swift_confirmation":
      return "SW";

    case "position_statement":
      return "CP";

    default:
      return "DOC";
  }
}

function formatDate(
  value: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function shortenRequestId(
  requestId: string,
) {
  if (requestId.length <= 16) {
    return requestId;
  }

  return `${requestId.slice(
    0,
    8,
  )}…${requestId.slice(-6)}`;
}

function canCancelDocument(
  document: CustomerDocument,
) {
  return CANCELLABLE_STATUSES.has(
    document.status,
  );
}

async function fetchDocuments() {
  const response = await fetch(
    `/api/documents?customerId=${encodeURIComponent(
      CUSTOMER_ID,
    )}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const data =
    (await response.json()) as
      | DocumentsResponse
      | {
          error?: string;
        };

  if (!response.ok) {
    throw new Error(
      "error" in data &&
      data.error
        ? data.error
        : "No se ha podido cargar el espacio documental.",
    );
  }

  return data as DocumentsResponse;
}

export default function DocumentsPage() {
  const [
    documentsResponse,
    setDocumentsResponse,
  ] = useState<DocumentsResponse | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    downloadingRequestId,
    setDownloadingRequestId,
  ] = useState<string | null>(null);

  const [
    cancellingRequestId,
    setCancellingRequestId,
  ] = useState<string | null>(null);

  const [
    filter,
    setFilter,
  ] = useState<
    "all" | "available" | "processing"
  >("all");

  const loadDocuments =
    useCallback(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data =
          await fetchDocuments();

        setDocumentsResponse(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se ha podido cargar el espacio documental.",
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    let cancelled = false;

    fetchDocuments()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setDocumentsResponse(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se ha podido cargar el espacio documental.",
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const documents = useMemo(
    () =>
      documentsResponse?.documents ??
      [],
    [documentsResponse],
  );

  const availableCount = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.status ===
            "completed" &&
          document.downloadAvailable,
      ).length,
    [documents],
  );

  const manualCount = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.processingMode ===
            "manual" &&
          document.status !==
            "completed" &&
          document.status !==
            "failed" &&
          document.status !==
            "cancelled",
      ).length,
    [documents],
  );

  const processingCount = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.status ===
            "processing" ||
          document.status ===
            "manual_processing" ||
          document.status ===
            "pending_manual_processing" ||
          document.status ===
            "confirmed",
      ).length,
    [documents],
  );

  const filteredDocuments = useMemo(
    () => {
      if (filter === "available") {
        return documents.filter(
          (document) =>
            document.status ===
              "completed" &&
            document.downloadAvailable,
        );
      }

      if (filter === "processing") {
        return documents.filter(
          (document) =>
            document.status ===
              "processing" ||
            document.status ===
              "manual_processing" ||
            document.status ===
              "pending_manual_processing" ||
            document.status ===
              "confirmed",
        );
      }

      return documents;
    },
    [documents, filter],
  );

  async function handleDownload(
    document: CustomerDocument,
  ) {
    if (!document.downloadAvailable) {
      return;
    }

    setDownloadingRequestId(
      document.requestId,
    );

    try {
      const response = await fetch(
        `/api/documents/${document.requestId}/download`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        let message =
          "No se ha podido descargar el documento.";

        try {
          const data =
            (await response.json()) as {
              error?: string;
            };

          if (data.error) {
            message = data.error;
          }
        } catch {
          // La respuesta no contiene JSON.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const contentDisposition =
        response.headers.get(
          "Content-Disposition",
        );

      const fileNameMatch =
        contentDisposition?.match(
          /filename="?([^"]+)"?/i,
        );

      const fileName =
        fileNameMatch?.[1] ??
        `${getDocumentName(
          document,
        )}.pdf`;

      const objectUrl =
        URL.createObjectURL(blob);

      const anchor =
        window.document.createElement(
          "a",
        );

      anchor.href = objectUrl;
      anchor.download = fileName;

      window.document.body.appendChild(
        anchor,
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      window.alert(
        downloadError instanceof Error
          ? downloadError.message
          : "No se ha podido descargar el documento.",
      );
    } finally {
      setDownloadingRequestId(null);
    }
  }

  async function handleCancel(
    document: CustomerDocument,
  ) {
    if (
      !canCancelDocument(document) ||
      cancellingRequestId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `¿Quieres anular la solicitud de "${getDocumentName(
          document,
        )}"?\n\nLa solicitud permanecerá en tu historial con estado "Anulada".`,
      );

    if (!confirmed) {
      return;
    }

    setCancellingRequestId(
      document.requestId,
    );

    try {
      const response = await fetch(
        `/api/documents/${document.requestId}/cancel`,
        {
          method: "POST",
          cache: "no-store",
        },
      );

      let data: CancellationResponse = {};

      try {
        data =
          (await response.json()) as CancellationResponse;
      } catch {
        // La respuesta no contiene JSON.
      }

      if (!response.ok) {
        throw new Error(
          data.error ??
            "No se ha podido anular la solicitud.",
        );
      }

      if (
        !data.cancelled &&
        data.status !== "cancelled"
      ) {
        throw new Error(
          "El servidor no ha confirmado la anulación de la solicitud.",
        );
      }

      await loadDocuments();
    } catch (cancelError) {
      window.alert(
        cancelError instanceof Error
          ? cancelError.message
          : "No se ha podido anular la solicitud.",
      );
    } finally {
      setCancellingRequestId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 border-b border-slate-800 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-300">
                F
              </div>

              <div>
                <p className="text-sm font-medium text-emerald-400">
                  Finora Docs AI
                </p>

                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Espacio documental
                </p>
              </div>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Mis documentos
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Consulta el estado de tus
              solicitudes y descarga los
              documentos que ya están
              disponibles.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void loadDocuments()
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
            >
              Actualizar
            </button>

            <a
              href="/request"
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Nueva solicitud
            </a>
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Solicitudes
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {documentsResponse?.total ??
                0}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Historial documental
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-400/80">
              Disponibles
            </p>

            <p className="mt-3 text-3xl font-semibold text-emerald-300">
              {availableCount}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Listos para descargar
            </p>
          </article>

          <article className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-400/80">
              En curso
            </p>

            <p className="mt-3 text-3xl font-semibold text-sky-300">
              {processingCount}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Solicitudes en tramitación
            </p>
          </article>

          <article className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-400/80">
              Gestión manual
            </p>

            <p className="mt-3 text-3xl font-semibold text-amber-300">
              {manualCount}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Requieren intervención
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60">
          <div className="flex flex-col gap-4 border-b border-slate-800 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-semibold">
                Historial de documentos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Cliente{" "}
                <span className="font-mono text-slate-400">
                  {documentsResponse?.customerId ??
                    CUSTOMER_ID}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setFilter("all")
                }
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  filter === "all"
                    ? "bg-slate-700 text-white"
                    : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                }`}
              >
                Todos
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilter(
                    "available",
                  )
                }
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  filter ===
                  "available"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                }`}
              >
                Disponibles
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilter(
                    "processing",
                  )
                }
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  filter ===
                  "processing"
                    ? "bg-sky-500/20 text-sky-300"
                    : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                }`}
              >
                En curso
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center px-6 py-12">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />

                <p className="text-sm text-slate-400">
                  Cargando espacio
                  documental...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="px-6 py-12">
              <div className="mx-auto max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                <p className="font-medium text-red-300">
                  No se han podido cargar
                  los documentos
                </p>

                <p className="mt-2 text-sm leading-6 text-red-200/70">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void loadDocuments()
                  }
                  className="mt-4 rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/10"
                >
                  Reintentar
                </button>
              </div>
            </div>
          ) : filteredDocuments.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-base font-medium text-slate-300">
                No hay documentos en esta
                categoría.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Puedes iniciar una nueva
                solicitud desde Finora.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredDocuments.map(
                (document) => {
                  const isDownloading =
                    downloadingRequestId ===
                    document.requestId;

                  const isCancelling =
                    cancellingRequestId ===
                    document.requestId;

                  const isCancellable =
                    canCancelDocument(
                      document,
                    );

                  return (
                    <article
                      key={
                        document.requestId
                      }
                      className="group flex flex-col gap-5 px-5 py-5 transition hover:bg-slate-900/40 sm:px-6 lg:flex-row lg:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300">
                          {getDocumentIcon(
                            document.documentType,
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-white">
                              {getDocumentName(
                                document,
                              )}
                            </h3>

                            {document.processingMode ===
                              "manual" && (
                              <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                                Gestión manual
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 text-sm text-slate-500">
                            Solicitado el{" "}
                            {formatDate(
                              document.createdAt,
                            )}
                          </p>

                          <p className="mt-1 font-mono text-[11px] text-slate-600">
                            {shortenRequestId(
                              document.requestId,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${getStatusClasses(
                            document.status,
                          )}`}
                        >
                          {getStatusLabel(
                            document.status,
                          )}
                        </span>

                        {isCancellable && (
                          <button
                            type="button"
                            disabled={
                              isCancelling ||
                              cancellingRequestId !==
                                null
                            }
                            onClick={() =>
                              void handleCancel(
                                document,
                              )
                            }
                            className="min-w-28 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:border-red-400/50 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isCancelling
                              ? "Anulando..."
                              : "Anular solicitud"}
                          </button>
                        )}

                        {document.downloadAvailable ? (
                          <button
                            type="button"
                            disabled={
                              isDownloading
                            }
                            onClick={() =>
                              void handleDownload(
                                document,
                              )
                            }
                            className="min-w-28 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDownloading
                              ? "Descargando..."
                              : "Descargar PDF"}
                          </button>
                        ) : document.status ===
                          "cancelled" ? (
                          <div className="min-w-28 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-2.5 text-center text-sm text-red-300/60">
                            Anulada
                          </div>
                        ) : (
                          <div className="min-w-28 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-center text-sm text-slate-600">
                            No disponible
                          </div>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
        </section>

        <footer className="mt-auto pt-8 text-center text-xs text-slate-600">
          Finora Docs AI · Espacio
          documental del cliente
        </footer>
      </div>
    </main>
  );
}
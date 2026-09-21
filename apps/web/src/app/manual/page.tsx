"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

interface ManualRequestCustomer {
  customerId: string | null;
  name: string | null;
  dni: string | null;
}

interface ManualRequest {
  requestId: string;
  documentName: string;
  status: string;
  customer: ManualRequestCustomer;
  createdAt: string;
  updatedAt: string;
}

interface ManualRequestsResponse {
  requests: ManualRequest[];
  total: number;
}

interface UploadResponse {
  requestId?: string;
  status?: string;
  document?: {
    fileName: string;
    contentType: string;
    size: number;
  };
  message?: string;
  error?: string;
  code?: string;
}

type StatusFilter =
  | "all"
  | "pending"
  | "processing";

type SortOrder =
  | "oldest"
  | "newest";

const MAX_PDF_SIZE =
  10 * 1024 * 1024;

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

function getStatusLabel(
  status: string,
) {
  switch (status) {
    case "pending_manual_processing":
      return "Pendiente";

    case "manual_processing":
      return "En tramitación";

    default:
      return status;
  }
}

function getStatusClasses(
  status: string,
) {
  switch (status) {
    case "pending_manual_processing":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "manual_processing":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";

    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function formatFileSize(
  bytes: number,
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

async function fetchManualRequests() {
  const response = await fetch(
    "/api/manual/requests",
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const data =
    (await response.json()) as
      | ManualRequestsResponse
      | {
          error?: string;
        };

  if (!response.ok) {
    throw new Error(
      "error" in data &&
      data.error
        ? data.error
        : "No se han podido cargar las solicitudes manuales.",
    );
  }

  return data as ManualRequestsResponse;
}

export default function ManualRequestsPage() {
  const [
    response,
    setResponse,
  ] =
    useState<ManualRequestsResponse | null>(
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
    selectedRequest,
    setSelectedRequest,
  ] = useState<ManualRequest | null>(
    null,
  );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(null);

  const [
    fileError,
    setFileError,
  ] = useState<string | null>(null);

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(null);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>("all");

  const [
    sortOrder,
    setSortOrder,
  ] =
    useState<SortOrder>("oldest");

  const [
    copiedRequestId,
    setCopiedRequestId,
  ] = useState<string | null>(null);

  const loadRequests =
    useCallback(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data =
          await fetchManualRequests();

        setResponse(data);

        setSelectedRequest(
          (currentRequest) => {
            if (!currentRequest) {
              return null;
            }

            return (
              data.requests.find(
                (request) =>
                  request.requestId ===
                  currentRequest.requestId,
              ) ?? null
            );
          },
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se han podido cargar las solicitudes manuales.",
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    let cancelled = false;

    fetchManualRequests()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setResponse(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se han podido cargar las solicitudes manuales.",
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

  const requests = useMemo(
    () => response?.requests ?? [],
    [response],
  );

  const pendingCount = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status ===
          "pending_manual_processing",
      ).length,
    [requests],
  );

  const processingCount = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status ===
          "manual_processing",
      ).length,
    [requests],
  );

  const visibleRequests = useMemo(
    () => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLocaleLowerCase(
            "es-ES",
          );

      const filtered =
        requests.filter(
          (request) => {
            if (
              statusFilter ===
                "pending" &&
              request.status !==
                "pending_manual_processing"
            ) {
              return false;
            }

            if (
              statusFilter ===
                "processing" &&
              request.status !==
                "manual_processing"
            ) {
              return false;
            }

            if (!normalizedSearch) {
              return true;
            }

            const searchableValues = [
              request.documentName,
              request.requestId,
              request.customer.name ?? "",
              request.customer.dni ?? "",
              request.customer.customerId ??
                "",
            ];

            return searchableValues.some(
              (value) =>
                value
                  .toLocaleLowerCase(
                    "es-ES",
                  )
                  .includes(
                    normalizedSearch,
                  ),
            );
          },
        );

      return [...filtered].sort(
        (a, b) => {
          const aTime =
            new Date(
              a.createdAt,
            ).getTime();

          const bTime =
            new Date(
              b.createdAt,
            ).getTime();

          if (sortOrder === "oldest") {
            return aTime - bTime;
          }

          return bTime - aTime;
        },
      );
    },
    [
      requests,
      searchTerm,
      statusFilter,
      sortOrder,
    ],
  );

  function handleSelectRequest(
    request: ManualRequest,
  ) {
    setSelectedRequest(request);
    setSelectedFile(null);
    setFileError(null);
    setSuccessMessage(null);
    setCopiedRequestId(null);
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setFileError(null);
    setSuccessMessage(null);

    const file =
      event.target.files?.[0] ??
      null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (
      file.type !==
      "application/pdf"
    ) {
      setSelectedFile(null);

      setFileError(
        "El documento debe ser un archivo PDF.",
      );

      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);

      setFileError(
        "El documento PDF está vacío.",
      );

      event.target.value = "";
      return;
    }

    if (
      file.size >
      MAX_PDF_SIZE
    ) {
      setSelectedFile(null);

      setFileError(
        "El documento supera el tamaño máximo permitido de 10 MB.",
      );

      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  async function handleCopyRequestId() {
    if (!selectedRequest) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        selectedRequest.requestId,
      );

      setCopiedRequestId(
        selectedRequest.requestId,
      );

      window.setTimeout(() => {
        setCopiedRequestId(null);
      }, 2000);
    } catch {
      setFileError(
        "No se ha podido copiar el identificador de la solicitud.",
      );
    }
  }

  async function handleUpload() {
    if (
      !selectedRequest ||
      !selectedFile ||
      isUploading
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `¿Quieres incorporar "${selectedFile.name}" a la solicitud de "${selectedRequest.documentName}"?\n\nAl completar la operación, el documento quedará disponible para el cliente.`,
      );

    if (!confirmed) {
      return;
    }

    setIsUploading(true);
    setFileError(null);
    setSuccessMessage(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile,
      );

      const uploadResponse =
        await fetch(
          `/api/manual/requests/${selectedRequest.requestId}/document`,
          {
            method: "POST",
            body: formData,
            cache: "no-store",
          },
        );

      let data: UploadResponse = {};

      try {
        data =
          (await uploadResponse.json()) as UploadResponse;
      } catch {
        // La respuesta no contiene JSON.
      }

      if (!uploadResponse.ok) {
        throw new Error(
          data.error ??
            "No se ha podido incorporar el documento.",
        );
      }

      if (
        data.status !== "completed"
      ) {
        throw new Error(
          "El servidor no ha confirmado la finalización de la solicitud.",
        );
      }

      setSuccessMessage(
        data.message ??
          "Documento incorporado correctamente.",
      );

      setSelectedFile(null);
      setSelectedRequest(null);
      setCopiedRequestId(null);

      const refreshedData =
        await fetchManualRequests();

      setResponse(refreshedData);
    } catch (uploadError) {
      setFileError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se ha podido incorporar el documento.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setSortOrder("oldest");
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 border-b border-slate-800 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm font-bold text-amber-300">
                F
              </div>

              <div>
                <p className="text-sm font-medium text-emerald-400">
                  Finora Docs AI
                </p>

                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Gestión interna
                </p>
              </div>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Gestión manual
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Tramita las solicitudes que
              requieren intervención humana
              e incorpora el documento final
              al espacio documental del
              cliente.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadRequests()
            }
            disabled={isLoading}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Solicitudes manuales
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {response?.total ?? 0}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Pendientes de completar
            </p>
          </article>

          <article className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-400/80">
              Pendientes
            </p>

            <p className="mt-3 text-3xl font-semibold text-amber-300">
              {pendingCount}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Esperando gestión
            </p>
          </article>

          <article className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-400/80">
              En tramitación
            </p>

            <p className="mt-3 text-3xl font-semibold text-sky-300">
              {processingCount}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Gestionadas actualmente
            </p>
          </article>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_auto_auto] xl:items-end">
            <div>
              <label
                htmlFor="manual-search"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500"
              >
                Buscar solicitudes
              </label>

              <input
                id="manual-search"
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value,
                  )
                }
                placeholder="Documento, cliente, DNI o ID..."
                className="w-full rounded-xl border border-slate-700 bg-[#020817] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-slate-500"
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Estado
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      "all",
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    statusFilter ===
                    "all"
                      ? "border-slate-500 bg-slate-700 text-white"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  Todas
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      "pending",
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    statusFilter ===
                    "pending"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  Pendientes
                  <span className="ml-2 text-xs opacity-70">
                    {pendingCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      "processing",
                    )
                  }
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    statusFilter ===
                    "processing"
                      ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  En tramitación
                  <span className="ml-2 text-xs opacity-70">
                    {processingCount}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="manual-sort"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500"
              >
                Orden
              </label>

              <select
                id="manual-sort"
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(
                    event.target
                      .value as SortOrder,
                  )
                }
                className="rounded-xl border border-slate-700 bg-[#020817] px-4 py-2.5 text-sm text-slate-200 outline-none transition focus:border-slate-500"
              >
                <option value="oldest">
                  Más antiguas primero
                </option>

                <option value="newest">
                  Más recientes primero
                </option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Mostrando{" "}
              <span className="font-medium text-slate-300">
                {visibleRequests.length}
              </span>{" "}
              de{" "}
              <span className="font-medium text-slate-300">
                {requests.length}
              </span>{" "}
              solicitudes
            </p>

            {(searchTerm ||
              statusFilter !== "all" ||
              sortOrder !== "oldest") && (
              <button
                type="button"
                onClick={clearFilters}
                className="self-start text-xs font-medium text-slate-400 transition hover:text-white sm:self-auto"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        </section>

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60">
            <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold">
                Bandeja de solicitudes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Selecciona una solicitud
                para consultar sus datos e
                incorporar el documento
                preparado por el gestor.
              </p>
            </div>

            {isLoading ? (
              <div className="flex min-h-72 items-center justify-center px-6 py-12">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />

                  <p className="text-sm text-slate-400">
                    Cargando solicitudes...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="px-6 py-12">
                <div className="mx-auto max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                  <p className="font-medium text-red-300">
                    No se ha podido cargar
                    la bandeja
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-200/70">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      void loadRequests()
                    }
                    className="mt-4 rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/10"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            ) : requests.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  ✓
                </div>

                <p className="mt-4 text-base font-medium text-slate-300">
                  No hay solicitudes
                  manuales pendientes.
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  La bandeja está al día.
                </p>
              </div>
            ) : visibleRequests.length ===
              0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-lg text-slate-400">
                  ?
                </div>

                <p className="mt-4 text-base font-medium text-slate-300">
                  No hay coincidencias.
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Prueba con otra búsqueda
                  o cambia los filtros.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900"
                >
                  Restablecer filtros
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {visibleRequests.map(
                  (manualRequest) => {
                    const isSelected =
                      selectedRequest
                        ?.requestId ===
                      manualRequest.requestId;

                    return (
                      <button
                        key={
                          manualRequest.requestId
                        }
                        type="button"
                        onClick={() =>
                          handleSelectRequest(
                            manualRequest,
                          )
                        }
                        className={`relative flex w-full flex-col gap-4 px-5 py-5 text-left transition sm:px-6 ${
                          isSelected
                            ? "bg-amber-500/[0.08]"
                            : "hover:bg-slate-900/50"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
                        )}

                        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-4">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold ${
                                isSelected
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  : "border-slate-700 bg-slate-900 text-slate-300"
                              }`}
                            >
                              DOC
                            </div>

                            <div className="min-w-0">
                              <h3 className="font-medium text-white">
                                {
                                  manualRequest.documentName
                                }
                              </h3>

                              <p className="mt-1.5 text-sm text-slate-400">
                                {manualRequest
                                  .customer
                                  .name ??
                                  "Cliente no disponible"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                DNI{" "}
                                {manualRequest
                                  .customer
                                  .dni ??
                                  "no disponible"}
                              </p>

                              <p className="mt-2 font-mono text-[11px] text-slate-600">
                                {shortenRequestId(
                                  manualRequest.requestId,
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <span
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${getStatusClasses(
                                manualRequest.status,
                              )}`}
                            >
                              {getStatusLabel(
                                manualRequest.status,
                              )}
                            </span>

                            <span className="text-xs text-slate-500">
                              {formatDate(
                                manualRequest.createdAt,
                              )}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </section>

          <aside className="self-start rounded-3xl border border-slate-800 bg-slate-950/60 lg:sticky lg:top-6">
            <div className="border-b border-slate-800 px-5 py-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Tramitación
              </p>

              <h2 className="mt-2 text-lg font-semibold">
                Incorporar documento
              </h2>
            </div>

            {!selectedRequest ? (
              <div className="px-5 py-10">
                {successMessage ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <p className="font-medium text-emerald-300">
                      Documento incorporado
                    </p>

                    <p className="mt-2 text-sm leading-6 text-emerald-200/70">
                      {successMessage}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      La solicitud ha sido
                      completada y el
                      documento ya puede
                      aparecer en el espacio
                      documental del cliente.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm leading-6 text-slate-400">
                      Selecciona una
                      solicitud de la bandeja
                      para consultar sus
                      datos y adjuntar el PDF
                      final.
                    </p>

                    <div className="mt-6 rounded-2xl border border-dashed border-slate-800 px-5 py-8 text-center">
                      <p className="text-sm text-slate-600">
                        Ninguna solicitud
                        seleccionada
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6 px-5 py-6">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                        Documento solicitado
                      </p>

                      <p className="mt-2 font-medium text-white">
                        {
                          selectedRequest.documentName
                        }
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${getStatusClasses(
                        selectedRequest.status,
                      )}`}
                    >
                      {getStatusLabel(
                        selectedRequest.status,
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div>
                    <p className="text-xs text-slate-600">
                      Cliente
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {selectedRequest
                        .customer.name ??
                        "No disponible"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">
                      DNI
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {selectedRequest
                        .customer.dni ??
                        "No disponible"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">
                      Cliente ID
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-slate-500">
                      {selectedRequest
                        .customer
                        .customerId ??
                        "No disponible"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">
                      Fecha de solicitud
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {formatDate(
                        selectedRequest.createdAt,
                      )}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-600">
                        Solicitud
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyRequestId()
                        }
                        className="text-xs font-medium text-slate-400 transition hover:text-white"
                      >
                        {copiedRequestId ===
                        selectedRequest.requestId
                          ? "Copiado"
                          : "Copiar ID"}
                      </button>
                    </div>

                    <p className="mt-1 break-all font-mono text-xs text-slate-500">
                      {
                        selectedRequest.requestId
                      }
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="manual-document"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Documento final
                  </label>

                  <label
                    htmlFor="manual-document"
                    className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950 px-5 py-8 text-center transition hover:border-amber-500/40 hover:bg-amber-500/[0.03]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-300">
                      PDF
                    </span>

                    <span className="mt-3 text-sm font-medium text-slate-300">
                      Seleccionar documento
                    </span>

                    <span className="mt-1 text-xs text-slate-600">
                      PDF · máximo 10 MB
                    </span>
                  </label>

                  <input
                    id="manual-document"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={
                      handleFileChange
                    }
                    disabled={isUploading}
                    className="sr-only"
                  />
                </div>

                {selectedFile && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold text-emerald-300">
                        PDF
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-emerald-200">
                          {selectedFile.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatFileSize(
                            selectedFile.size,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {fileError && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-sm leading-6 text-red-200">
                      {fileError}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={
                    !selectedFile ||
                    isUploading
                  }
                  onClick={() =>
                    void handleUpload()
                  }
                  className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isUploading
                    ? "Incorporando documento..."
                    : "Incorporar documento"}
                </button>

                <p className="text-xs leading-5 text-slate-600">
                  Al incorporar el PDF, la
                  solicitud se marcará como
                  completada y el documento
                  quedará almacenado en el
                  repositorio documental de
                  Finora.
                </p>
              </div>
            )}
          </aside>
        </div>

        <footer className="mt-auto pt-8 text-center text-xs text-slate-600">
          Finora Docs AI · Gestión interna
          de solicitudes documentales
        </footer>
      </div>
    </main>
  );
}
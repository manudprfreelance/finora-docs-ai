import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  DocumentRequest,
  DocumentType,
} from "@/lib/request-types";

import {
  getRequestSessionsByCustomerId,
} from "@/lib/server/request-store";

interface CustomerDocument {
  requestId: string;
  documentType: DocumentType;
  documentName: string;
  status: DocumentRequest["status"];
  processingMode: "automatic" | "manual";
  createdAt: string;
  updatedAt: string;
  downloadAvailable: boolean;
}

function isManualRequest(
  requestState: DocumentRequest,
): boolean {
  return (
    requestState.documentType === "unknown" &&
    Boolean(
      requestState.manualRequest
        ?.requestedDocumentDescription
        .trim(),
    )
  );
}

function getDocumentName(
  requestState: DocumentRequest,
): string {
  if (
    isManualRequest(requestState)
  ) {
    return (
      requestState.manualRequest
        ?.requestedDocumentDescription ??
      "Documento bancario"
    );
  }

  switch (requestState.documentType) {
    case "account_statement":
      return "Extracto de cuenta";

    case "position_statement":
      return "Certificado de posición";

    case "loan_amortization":
      return "Cuadro de amortización";

    case "swift_confirmation":
      return "Justificante SWIFT";

    default:
      return "Documento bancario";
  }
}

function getProcessingMode(
  requestState: DocumentRequest,
): "automatic" | "manual" {
  return isManualRequest(requestState)
    ? "manual"
    : "automatic";
}

function isDownloadAvailable(
  requestState: DocumentRequest,
): boolean {
  if (
    requestState.status !== "completed"
  ) {
    return false;
  }

  if (isManualRequest(requestState)) {
    return true;
  }

  return (
    requestState.documentType ===
      "account_statement" ||
    requestState.documentType ===
      "loan_amortization" ||
    requestState.documentType ===
      "swift_confirmation"
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const customerId =
      request.nextUrl.searchParams
        .get("customerId")
        ?.trim();

    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "El identificador del cliente es obligatorio.",
          code:
            "CUSTOMER_ID_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const storedRequests =
      await getRequestSessionsByCustomerId(
        customerId,
      );

    const documents: CustomerDocument[] =
      storedRequests.map(
        (storedRequest) => {
          const requestState =
            storedRequest.requestState;

          return {
            requestId:
              storedRequest.requestId,

            documentType:
              requestState.documentType,

            documentName:
              getDocumentName(
                requestState,
              ),

            status:
              requestState.status,

            processingMode:
              getProcessingMode(
                requestState,
              ),

            createdAt:
              storedRequest.createdAt,

            updatedAt:
              storedRequest.updatedAt,

            downloadAvailable:
              isDownloadAvailable(
                requestState,
              ),
          };
        },
      );

    return NextResponse.json(
      {
        customerId,
        documents,
        total: documents.length,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "Customer documents error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No se ha podido recuperar el espacio de documentos.",
        code:
          "CUSTOMER_DOCUMENTS_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
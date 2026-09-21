import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getRequestSession,
  saveRequestSession,
} from "@/lib/server/request-store";

import {
  storeManualDocumentPdf,
} from "@/lib/server/document-storage-service";

import {
  createRequestEvent,
} from "@/lib/server/request-event-repository";

const MAX_PDF_SIZE =
  10 * 1024 * 1024;

function hasPdfSignature(
  bytes: Uint8Array,
): boolean {
  if (bytes.byteLength < 5) {
    return false;
  }

  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      requestId: string;
    }>;
  },
) {
  try {
    const {
      requestId,
    } = await context.params;

    const normalizedRequestId =
      requestId.trim();

    if (!normalizedRequestId) {
      return NextResponse.json(
        {
          error:
            "El identificador de la solicitud es obligatorio.",
          code:
            "REQUEST_ID_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    const storedRequest =
      await getRequestSession(
        normalizedRequestId,
      );

    if (!storedRequest) {
      return NextResponse.json(
        {
          error:
            "La solicitud no existe.",
          code:
            "REQUEST_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const requestState =
      storedRequest.requestState;

    const isManualRequest =
      requestState.documentType ===
        "unknown" &&
      Boolean(
        requestState.manualRequest
          ?.requestedDocumentDescription
          .trim(),
      );

    if (!isManualRequest) {
      return NextResponse.json(
        {
          error:
            "La solicitud no corresponde a una gestión manual.",
          code:
            "NOT_MANUAL_REQUEST",
        },
        {
          status: 409,
        },
      );
    }

    if (
      requestState.status ===
      "cancelled"
    ) {
      return NextResponse.json(
        {
          error:
            "La solicitud está anulada y no admite documentos.",
          code:
            "REQUEST_CANCELLED",
        },
        {
          status: 409,
        },
      );
    }

    if (
      requestState.status ===
      "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "La solicitud ya dispone de un documento.",
          code:
            "REQUEST_ALREADY_COMPLETED",
        },
        {
          status: 409,
        },
      );
    }

    if (
      requestState.status !==
        "pending_manual_processing" &&
      requestState.status !==
        "manual_processing"
    ) {
      return NextResponse.json(
        {
          error:
            "La solicitud todavía no está disponible para tramitación manual.",
          code:
            "INVALID_MANUAL_REQUEST_STATUS",
        },
        {
          status: 409,
        },
      );
    }

    const customerId =
      requestState.customer.customerId;

    if (
      !customerId ||
      requestState.customer
        .resolutionStatus !==
        "resolved"
    ) {
      return NextResponse.json(
        {
          error:
            "La solicitud no tiene un cliente resuelto.",
          code:
            "CUSTOMER_NOT_RESOLVED",
        },
        {
          status: 409,
        },
      );
    }

    const formData =
      await request.formData();

    const uploadedFile =
      formData.get("file");

    if (
      !(uploadedFile instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "Debes adjuntar un documento PDF.",
          code:
            "FILE_REQUIRED",
        },
        {
          status: 400,
        },
      );
    }

    if (
      uploadedFile.type !==
      "application/pdf"
    ) {
      return NextResponse.json(
        {
          error:
            "El documento debe ser un archivo PDF.",
          code:
            "INVALID_FILE_TYPE",
        },
        {
          status: 415,
        },
      );
    }

    if (uploadedFile.size === 0) {
      return NextResponse.json(
        {
          error:
            "El documento PDF está vacío.",
          code:
            "EMPTY_FILE",
        },
        {
          status: 400,
        },
      );
    }

    if (
      uploadedFile.size >
      MAX_PDF_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "El documento supera el tamaño máximo permitido de 10 MB.",
          code:
            "FILE_TOO_LARGE",
        },
        {
          status: 413,
        },
      );
    }

    const fileBuffer =
      new Uint8Array(
        await uploadedFile.arrayBuffer(),
      );

    if (
      !hasPdfSignature(fileBuffer)
    ) {
      return NextResponse.json(
        {
          error:
            "El archivo recibido no contiene un PDF válido.",
          code:
            "INVALID_PDF_SIGNATURE",
        },
        {
          status: 415,
        },
      );
    }

    const storedDocument =
      await storeManualDocumentPdf(
        customerId,
        normalizedRequestId,
        fileBuffer,
      );

    const completedRequest = {
      ...requestState,

      status:
        "completed" as const,
    };

    await saveRequestSession(
      normalizedRequestId,
      completedRequest,
    );

    await createRequestEvent(
      normalizedRequestId,
      "manual_document_uploaded",
      {
        customerId,

        documentDescription:
          requestState.manualRequest
            ?.requestedDocumentDescription ??
          null,

        originalFileName:
          uploadedFile.name,

        storedFileName:
          storedDocument.fileName,

        bucket:
          storedDocument.bucket,

        objectKey:
          storedDocument.objectKey,

        contentType:
          storedDocument.contentType,

        size:
          storedDocument.size,

        previousStatus:
          requestState.status,

        resultingStatus:
          "completed",
      },
    );

    return NextResponse.json(
      {
        requestId:
          normalizedRequestId,

        status:
          "completed",

        document: {
          fileName:
            storedDocument.fileName,

          contentType:
            storedDocument.contentType,

          size:
            storedDocument.size,
        },

        message:
          "Documento manual incorporado correctamente.",
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
      "Manual document upload error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No se ha podido incorporar el documento manual.",
        code:
          "MANUAL_DOCUMENT_UPLOAD_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
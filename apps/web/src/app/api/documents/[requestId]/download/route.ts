import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAccountStatementPdf,
  getLoanAmortizationPdf,
  getSwiftConfirmationPdf,
} from "@/lib/server/document-storage-service";

import {
  getRequestSession,
} from "@/lib/server/request-store";

interface RouteContext {
  params: Promise<{
    requestId: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      requestId,
    } = await context.params;

    if (!requestId) {
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
        requestId,
      );

    if (!storedRequest) {
      return NextResponse.json(
        {
          error:
            "No se ha encontrado la solicitud.",
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

    if (
      requestState.status !==
      "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "El documento todavía no está disponible para descarga.",
          code:
            "DOCUMENT_NOT_READY",
        },
        {
          status: 409,
        },
      );
    }

    const customerId =
      requestState.customer
        .customerId;

    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "La solicitud no tiene un cliente válido asociado.",
          code:
            "CUSTOMER_NOT_RESOLVED",
        },
        {
          status: 409,
        },
      );
    }

    let document;

    switch (
      requestState.documentType
    ) {
      case "account_statement":
        document =
          await getAccountStatementPdf(
            customerId,
            requestId,
          );

        break;

      case "loan_amortization":
        document =
          await getLoanAmortizationPdf(
            customerId,
            requestId,
          );

        break;

      case "swift_confirmation":
        document =
          await getSwiftConfirmationPdf(
            customerId,
            requestId,
          );

        break;

      default:
        return NextResponse.json(
          {
            error:
              "La descarga todavía no está disponible para este tipo de documento.",
            code:
              "DOCUMENT_TYPE_NOT_SUPPORTED",
          },
          {
            status: 400,
          },
        );
    }

    if (!document) {
      return NextResponse.json(
        {
          error:
            "El documento no se ha encontrado en el almacenamiento.",
          code:
            "DOCUMENT_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const pdfBuffer =
      Buffer.from(
        document.body,
      );

    return new Response(
      pdfBuffer,
      {
        status: 200,

        headers: {
          "Content-Type":
            document.contentType,

          "Content-Disposition":
            `attachment; filename="${document.fileName}"`,

          "Content-Length":
            pdfBuffer.length.toString(),

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "Document download error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No se ha podido descargar el documento.",
        code:
          "DOCUMENT_DOWNLOAD_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
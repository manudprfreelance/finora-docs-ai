import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAccountStatementPdf,
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

    /*
     * Recuperamos la solicitud desde
     * PostgreSQL.
     *
     * El navegador nunca decide:
     * - qué customerId usar,
     * - qué bucket consultar,
     * - qué objectKey descargar.
     *
     * Toda esa información se deriva
     * desde el estado persistido del
     * servidor.
     */
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

    /*
     * Solo entregamos documentos cuyo
     * procesamiento haya finalizado.
     */
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

    /*
     * En este bloque implementamos
     * exclusivamente el camino del
     * extracto de cuenta.
     *
     * Loan amortization y SWIFT
     * se incorporarán después usando
     * el mismo patrón.
     */
    if (
      requestState.documentType !==
      "account_statement"
    ) {
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

    /*
     * La ruta de MinIO se calcula
     * exclusivamente en el servidor:
     *
     * customers/
     *   customer-001/
     *     account-statements/
     *       requestId/
     *         account-statement-requestId.pdf
     */
    const document =
      await getAccountStatementPdf(
        customerId,
        requestId,
      );

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

    /*
     * Buffer permanece únicamente en el
     * backend. El navegador recibe una
     * respuesta HTTP PDF convencional.
     */
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

          /*
           * La documentación bancaria no
           * debe quedar cacheada de manera
           * compartida.
           */
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
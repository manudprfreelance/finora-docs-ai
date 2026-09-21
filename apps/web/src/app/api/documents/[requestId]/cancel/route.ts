import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  DocumentRequest,
} from "@/lib/request-types";

import {
  createRequestEvent,
} from "@/lib/server/request-event-repository";

import {
  claimRequestForCancellation,
  getRequestSession,
} from "@/lib/server/request-store";

interface RouteContext {
  params: Promise<{
    requestId: string;
  }>;
}

const CANCELLABLE_STATUSES:
  DocumentRequest["status"][] = [
    "collecting_information",
    "ready_for_confirmation",
    "confirmed",
    "pending_manual_processing",
  ];

function canCancelRequest(
  requestState: DocumentRequest,
): boolean {
  return CANCELLABLE_STATUSES.includes(
    requestState.status,
  );
}

export async function POST(
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

    const currentState =
      storedRequest.requestState;

    if (
      currentState.status ===
      "cancelled"
    ) {
      return NextResponse.json(
        {
          requestId,
          status: "cancelled",
          cancelled: true,
          duplicatePrevented: true,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "private, no-store, max-age=0",
          },
        },
      );
    }

    if (
      !canCancelRequest(
        currentState,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "La solicitud ya no puede anularse porque su tramitación ha avanzado.",
          code:
            "REQUEST_NOT_CANCELLABLE",
          status:
            currentState.status,
        },
        {
          status: 409,
        },
      );
    }

    const cancelledState: DocumentRequest = {
      ...currentState,
      status: "cancelled",
    };

    const claimedRequest =
      await claimRequestForCancellation(
        requestId,
        cancelledState,
      );

    if (!claimedRequest) {
      const latestRequest =
        await getRequestSession(
          requestId,
        );

      if (
        latestRequest
          ?.requestState.status ===
        "cancelled"
      ) {
        return NextResponse.json(
          {
            requestId,
            status: "cancelled",
            cancelled: true,
            duplicatePrevented: true,
          },
          {
            status: 200,
            headers: {
              "Cache-Control":
                "private, no-store, max-age=0",
            },
          },
        );
      }

      return NextResponse.json(
        {
          error:
            "La solicitud ha cambiado de estado y ya no puede anularse.",
          code:
            "REQUEST_CANCELLATION_CONFLICT",
          status:
            latestRequest
              ?.requestState.status ??
            null,
        },
        {
          status: 409,
        },
      );
    }

    await createRequestEvent(
      requestId,
      "request_cancelled",
      {
        previousStatus:
          currentState.status,

        status:
          "cancelled",

        customerId:
          currentState.customer
            .customerId,

        documentType:
          currentState.documentType,

        processingMode:
          currentState.documentType ===
            "unknown" &&
          currentState.manualRequest
            ? "manual"
            : "automatic",
      },
    );

    return NextResponse.json(
      {
        requestId,
        status: "cancelled",
        cancelled: true,
        duplicatePrevented: false,
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
      "Request cancellation error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No se ha podido anular la solicitud.",
        code:
          "REQUEST_CANCELLATION_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
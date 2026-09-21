import { NextResponse } from "next/server";

import {
  getManualRequestSessions,
} from "@/lib/server/request-store";

interface ManualRequestListItem {
  requestId: string;

  documentName: string;

  status:
    | "pending_manual_processing"
    | "manual_processing";

  customer: {
    customerId: string | null;
    name: string | null;
    dni: string | null;
  };

  createdAt: string;

  updatedAt: string;
}

export async function GET() {
  try {
    const storedRequests =
      await getManualRequestSessions();

    const requests: ManualRequestListItem[] =
      storedRequests
        .filter(
          (storedRequest) =>
            storedRequest.requestState
              .status ===
              "pending_manual_processing" ||
            storedRequest.requestState
              .status ===
              "manual_processing",
        )
        .map((storedRequest) => {
          const requestState =
            storedRequest.requestState;

          const status =
            requestState.status;

          if (
            status !==
              "pending_manual_processing" &&
            status !==
              "manual_processing"
          ) {
            throw new Error(
              "Unexpected manual request status.",
            );
          }

          return {
            requestId:
              storedRequest.requestId,

            documentName:
              requestState.manualRequest
                ?.requestedDocumentDescription ??
              "Documento bancario",

            status,

            customer: {
              customerId:
                requestState.customer
                  .customerId,

              name:
                requestState.customer.name,

              dni:
                requestState.customer.dni,
            },

            createdAt:
              storedRequest.createdAt,

            updatedAt:
              storedRequest.updatedAt,
          };
        });

    return NextResponse.json(
      {
        requests,

        total: requests.length,
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
      "Manual requests list error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "No se han podido recuperar las solicitudes de gestión manual.",

        code:
          "MANUAL_REQUESTS_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
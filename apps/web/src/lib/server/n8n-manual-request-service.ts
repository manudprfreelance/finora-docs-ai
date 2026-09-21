import {
  DocumentRequest,
} from "@/lib/request-types";

interface N8nManualRequestResponse {
  requestId?: string;
  customerId?: string;
  customerName?: string;
  customerDni?: string;
  requestedDocumentDescription?: string;
  status?: string;
  externalReference?: string;
  acceptedAt?: string;
}

export interface ManualRequestDispatchResult {
  requestId: string;
  status:
    | "accepted"
    | "failed";
  provider: "n8n";
  externalReference: string | null;
  acceptedAt: string | null;
  output: Record<string, unknown>;
  error: string | null;
}

export class N8nManualRequestService {
  async dispatch(
    requestId: string,
    requestState: DocumentRequest,
  ): Promise<ManualRequestDispatchResult> {
    if (
      requestState.status !==
      "pending_manual_processing"
    ) {
      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        acceptedAt: null,
        output: {},
        error:
          "Only requests in pending_manual_processing state can be dispatched.",
      };
    }

    const requestedDocumentDescription =
      requestState.manualRequest
        ?.requestedDocumentDescription
        .trim() ?? "";

    if (
      !requestedDocumentDescription
    ) {
      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        acceptedAt: null,
        output: {},
        error:
          "Manual document description is missing.",
      };
    }

    if (
      requestState.customer
        .resolutionStatus !==
        "resolved" ||
      !requestState.customer.customerId ||
      !requestState.customer.name ||
      !requestState.customer.dni
    ) {
      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        acceptedAt: null,
        output: {},
        error:
          "Resolved customer data is required for manual processing.",
      };
    }

    const webhookUrl =
      process.env
        .N8N_MANUAL_REQUEST_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        acceptedAt: null,
        output: {},
        error:
          "N8N_MANUAL_REQUEST_WEBHOOK_URL is not configured.",
      };
    }

    try {
      const response = await fetch(
        webhookUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            requestId,

            customerId:
              requestState.customer
                .customerId,

            customerName:
              requestState.customer
                .name,

            customerDni:
              requestState.customer
                .dni,

            requestedDocumentDescription,
          }),
        },
      );

      if (!response.ok) {
        return {
          requestId,
          status: "failed",
          provider: "n8n",
          externalReference: null,
          acceptedAt: null,
          output: {},
          error:
            `n8n returned HTTP ${response.status}.`,
        };
      }

      let data:
        N8nManualRequestResponse;

      try {
        data =
          (await response.json()) as
            N8nManualRequestResponse;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Invalid JSON response.";

        return {
          requestId,
          status: "failed",
          provider: "n8n",
          externalReference: null,
          acceptedAt: null,
          output: {},
          error:
            `n8n returned an invalid JSON response: ${errorMessage}`,
        };
      }

      if (
        data.status !== "accepted"
      ) {
        return {
          requestId,
          status: "failed",
          provider: "n8n",

          externalReference:
            data.externalReference ??
            null,

          acceptedAt:
            data.acceptedAt ??
            null,

          output: {
            ...data,
          },

          error:
            `n8n returned unexpected status: ${data.status ?? "unknown"}.`,
        };
      }

      if (
        data.requestId &&
        data.requestId !== requestId
      ) {
        return {
          requestId,
          status: "failed",
          provider: "n8n",

          externalReference:
            data.externalReference ??
            null,

          acceptedAt:
            data.acceptedAt ??
            null,

          output: {
            ...data,
          },

          error:
            "n8n returned a response for a different requestId.",
        };
      }

      return {
        requestId,
        status: "accepted",
        provider: "n8n",

        externalReference:
          data.externalReference ??
          null,

        acceptedAt:
          data.acceptedAt ??
          null,

        output: {
          ...data,
        },

        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unexpected n8n manual request error.";

      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        acceptedAt: null,
        output: {},
        error:
          errorMessage,
      };
    }
  }
}

export const manualRequestService =
  new N8nManualRequestService();
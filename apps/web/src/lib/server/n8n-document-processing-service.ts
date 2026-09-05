import {
  DocumentProcessingResult,
  DocumentProcessingService,
} from "@/lib/server/document-processing-service";

import {
  DocumentRequest,
} from "@/lib/request-types";

interface N8nProcessingResponse {
  requestId?: string;
  documentType?: string;
  customerId?: string;
  status?: string;
  processedAt?: string;
  externalReference?: string;
}

export class N8nDocumentProcessingService
  implements DocumentProcessingService
{
  async process(
    requestId: string,
    requestState: DocumentRequest,
  ): Promise<DocumentProcessingResult> {
    if (
      requestState.status !==
      "processing"
    ) {
      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        output: {},
        error:
          "Only requests in processing state can be processed.",
      };
    }

    const webhookUrl =
      process.env
        .N8N_DOCUMENT_PROCESSING_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        output: {},
        error:
          "N8N_DOCUMENT_PROCESSING_WEBHOOK_URL is not configured.",
      };
    }

    const selectedAccountId =
      requestState.selectedAccount
        ?.accountId ?? null;

    const dateFrom =
      requestState.dateRange?.from ??
      null;

    const dateTo =
      requestState.dateRange?.to ??
      null;

    const accountMovements =
      requestState.availableMovements
        .filter((movement) => {
          if (
            selectedAccountId &&
            movement.accountId !==
              selectedAccountId
          ) {
            return false;
          }

          if (
            dateFrom &&
            movement.date < dateFrom
          ) {
            return false;
          }

          if (
            dateTo &&
            movement.date > dateTo
          ) {
            return false;
          }

          return true;
        })
        .map((movement) => ({
          movementId:
            movement.movementId,

          accountId:
            movement.accountId,

          date:
            movement.date,

          description:
            movement.description,

          amount:
            movement.amount,

          currency:
            movement.currency,
        }));

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

            documentType:
              requestState.documentType,

            customerId:
              requestState.customer
                .customerId,

            customerName:
              requestState.customer
                .name ?? null,

            customerDni:
              requestState.customer
                .dni ?? null,

            accountId:
              selectedAccountId,

            accountName:
              requestState.selectedAccount
                ?.accountName ?? null,

            maskedAccountNumber:
              requestState.selectedAccount
                ?.maskedAccountNumber ??
              null,

            loanId:
              requestState.selectedLoan
                ?.loanId ?? null,

            loanName:
              requestState.selectedLoan
                ?.loanName ?? null,

            maskedLoanNumber:
              requestState.selectedLoan
                ?.maskedLoanNumber ??
              null,

            movementId:
              requestState.selectedMovement
                ?.movementId ?? null,

            movementDescription:
              requestState.selectedMovement
                ?.description ?? null,

            movementAmount:
              requestState.selectedMovement
                ?.amount ?? null,

            movementCurrency:
              requestState.selectedMovement
                ?.currency ?? null,

            movementDate:
              requestState.selectedMovement
                ?.date ?? null,

            dateRange:
              requestState.dateRange,

            accountMovements,
          }),
        },
      );

      if (!response.ok) {
        return {
          requestId,
          status: "failed",
          provider: "n8n",
          externalReference: null,
          output: {},
          error:
            `n8n returned HTTP ${response.status}.`,
        };
      }

      const data =
        (await response.json()) as
          N8nProcessingResponse;

      if (
        data.status !==
        "completed"
      ) {
        return {
          requestId,
          status: "failed",
          provider: "n8n",

          externalReference:
            data.externalReference ??
            null,

          output: {
            ...data,
          },

          error:
            `n8n returned unexpected status: ${data.status ?? "unknown"}.`,
        };
      }

      return {
        requestId,
        status: "completed",
        provider: "n8n",

        externalReference:
          data.externalReference ??
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
          : "Unexpected n8n processing error.";

      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        output: {},
        error:
          errorMessage,
      };
    }
  }
}

export const documentProcessingService =
  new N8nDocumentProcessingService();
import {
  DocumentProcessingResult,
  DocumentProcessingService,
} from "@/lib/server/document-processing-service";

import {
  DocumentRequest,
} from "@/lib/request-types";

export class LocalDocumentProcessingService
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

        provider:
          "local-simulator",

        externalReference: null,

        output: {},

        error:
          "Only requests in processing state can be processed.",
      };
    }

    /*
     * Esta implementación no genera todavía
     * un documento real.
     *
     * Simula el resultado que posteriormente
     * devolverá n8n.
     */
    return {
      requestId,
      status: "completed",

      provider:
        "local-simulator",

      externalReference:
        `local-${requestId}`,

      output: {
        documentType:
          requestState.documentType,

        customerId:
          requestState.customer
            .customerId,

        accountId:
          requestState.selectedAccount
            ?.accountId ?? null,

        loanId:
          requestState.selectedLoan
            ?.loanId ?? null,

        movementId:
          requestState.selectedMovement
            ?.movementId ?? null,

        dateRange:
          requestState.dateRange,

        simulated: true,
      },

      error: null,
    };
  }
}

export const documentProcessingService =
  new LocalDocumentProcessingService();
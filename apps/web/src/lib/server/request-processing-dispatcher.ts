import {
  DocumentRequest,
} from "@/lib/request-types";

import {
  documentProcessingService,
} from "@/lib/server/n8n-document-processing-service";

import {
  createRequestEvent,
} from "@/lib/server/request-event-repository";

import {
  claimRequestForProcessing,
  getRequestSession,
  saveRequestSession,
} from "@/lib/server/request-store";

export interface RequestProcessingDispatchResult {
  requestId: string;
  requestState: DocumentRequest;
  provider: string | null;
  externalReference: string | null;
  output: Record<string, unknown>;
  error: string | null;
  duplicatePrevented: boolean;
}

export async function processConfirmedRequest(
  requestId: string,
): Promise<RequestProcessingDispatchResult> {
  const storedRequest =
    await getRequestSession(requestId);

  if (!storedRequest) {
    throw new Error(
      `Request session ${requestId} was not found.`,
    );
  }

  if (
    storedRequest.requestState.status !==
    "confirmed"
  ) {
    if (
      storedRequest.requestState.status ===
        "processing" ||
      storedRequest.requestState.status ===
        "completed"
    ) {
      await createRequestEvent(
        requestId,
        "request_processing_duplicate_prevented",
        {
          documentType:
            storedRequest.requestState.documentType,
          customerId:
            storedRequest.requestState.customer
              .customerId,
          status:
            storedRequest.requestState.status,
          reason:
            "request_already_claimed_or_completed",
        },
      );

      return {
        requestId,
        requestState:
          storedRequest.requestState,
        provider: null,
        externalReference: null,
        output: {},
        error: null,
        duplicatePrevented: true,
      };
    }

    throw new Error(
      "Only confirmed requests can be dispatched for processing.",
    );
  }

  const processingRequest: DocumentRequest = {
    ...storedRequest.requestState,
    status: "processing",
  };

  /*
   * Claim atómico en PostgreSQL.
   *
   * Solo una ejecución puede cambiar
   * confirmed -> processing.
   */
  const claimedRequest =
    await claimRequestForProcessing(
      requestId,
      processingRequest,
    );

  if (!claimedRequest) {
    const latestRequest =
      await getRequestSession(requestId);

    if (!latestRequest) {
      throw new Error(
        `Request session ${requestId} was not found after processing claim.`,
      );
    }

    await createRequestEvent(
      requestId,
      "request_processing_duplicate_prevented",
      {
        documentType:
          latestRequest.requestState.documentType,
        customerId:
          latestRequest.requestState.customer
            .customerId,
        status:
          latestRequest.requestState.status,
        reason:
          "atomic_processing_claim_not_acquired",
      },
    );

    return {
      requestId,
      requestState:
        latestRequest.requestState,
      provider: null,
      externalReference: null,
      output: {},
      error: null,
      duplicatePrevented: true,
    };
  }

  await createRequestEvent(
    requestId,
    "request_processing_started",
    {
      documentType:
        processingRequest.documentType,

      customerId:
        processingRequest.customer
          .customerId,

      previousStatus: "confirmed",

      status: "processing",
    },
  );

  try {
    const processingResult =
      await documentProcessingService.process(
        requestId,
        processingRequest,
      );

    if (
      processingResult.status ===
      "failed"
    ) {
      const failedRequest: DocumentRequest = {
        ...processingRequest,
        status: "failed",
      };

      await saveRequestSession(
        requestId,
        failedRequest,
      );

      await createRequestEvent(
        requestId,
        "request_processing_failed",
        {
          documentType:
            failedRequest.documentType,

          customerId:
            failedRequest.customer
              .customerId,

          provider:
            processingResult.provider,

          externalReference:
            processingResult.externalReference,

          error:
            processingResult.error,

          status: "failed",
        },
      );

      return {
        requestId,
        requestState:
          failedRequest,
        provider:
          processingResult.provider,
        externalReference:
          processingResult.externalReference,
        output:
          processingResult.output,
        error:
          processingResult.error,
        duplicatePrevented: false,
      };
    }

    const completedRequest: DocumentRequest = {
      ...processingRequest,
      status: "completed",
    };

    await saveRequestSession(
      requestId,
      completedRequest,
    );

    await createRequestEvent(
      requestId,
      "request_processing_completed",
      {
        documentType:
          completedRequest.documentType,

        customerId:
          completedRequest.customer
            .customerId,

        provider:
          processingResult.provider,

        externalReference:
          processingResult.externalReference,

        status: "completed",
      },
    );

    return {
      requestId,
      requestState:
        completedRequest,
      provider:
        processingResult.provider,
      externalReference:
        processingResult.externalReference,
      output:
        processingResult.output,
      error: null,
      duplicatePrevented: false,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unexpected document processing error.";

    const failedRequest: DocumentRequest = {
      ...processingRequest,
      status: "failed",
    };

    await saveRequestSession(
      requestId,
      failedRequest,
    );

    await createRequestEvent(
      requestId,
      "request_processing_failed",
      {
        documentType:
          failedRequest.documentType,

        customerId:
          failedRequest.customer
            .customerId,

        provider: "n8n",

        externalReference: null,

        error:
          errorMessage,

        status: "failed",
      },
    );

    return {
      requestId,
      requestState:
        failedRequest,
      provider: "n8n",
      externalReference: null,
      output: {},
      error:
        errorMessage,
      duplicatePrevented: false,
    };
  }
}

import {
  DocumentRequest,
} from "@/lib/request-types";

import {
  documentProcessingService,
} from "@/lib/server/local-document-processing-service";

import {
  createRequestEvent,
} from "@/lib/server/request-event-repository";

import {
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
    throw new Error(
      "Only confirmed requests can be dispatched for processing.",
    );
  }

  /*
   * Primera transición:
   *
   * confirmed -> processing
   */
  const processingRequest: DocumentRequest = {
    ...storedRequest.requestState,
    status: "processing",
  };

  await saveRequestSession(
    requestId,
    processingRequest,
  );

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
    /*
     * El servicio concreto está desacoplado.
     *
     * Hoy:
     * LocalDocumentProcessingService
     *
     * Después:
     * N8nDocumentProcessingService
     */
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
    };
  } catch (error) {
    /*
     * Si el proveedor lanza una excepción
     * inesperada también debemos dejar la
     * solicitud en un estado consistente.
     */
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

        provider: null,

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
      provider: null,
      externalReference: null,
      output: {},
      error:
        errorMessage,
    };
  }
}
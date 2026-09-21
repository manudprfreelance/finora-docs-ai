import {
  createEmptyDocumentRequest,
  DocumentRequest,
} from "@/lib/request-types";

import {
  requestRepository,
} from "@/lib/server/postgres-request-repository";

export async function createRequestSession() {
  return requestRepository.create(
    createEmptyDocumentRequest(),
  );
}

export async function getRequestSession(
  requestId: string,
) {
  return requestRepository.findById(
    requestId,
  );
}

export async function getRequestSessionsByCustomerId(
  customerId: string,
) {
  return requestRepository.findByCustomerId(
    customerId,
  );
}

export async function getManualRequestSessions() {
  return requestRepository.findManualRequests();
}

export async function saveRequestSession(
  requestId: string,
  requestState: DocumentRequest,
) {
  return requestRepository.save(
    requestId,
    requestState,
  );
}

export async function claimRequestForConfirmation(
  requestId: string,
  confirmedState: DocumentRequest,
) {
  return requestRepository.claimForConfirmation(
    requestId,
    confirmedState,
  );
}

export async function claimRequestForProcessing(
  requestId: string,
  processingState: DocumentRequest,
) {
  return requestRepository.claimForProcessing(
    requestId,
    processingState,
  );
}

export async function claimRequestForCancellation(
  requestId: string,
  cancelledState: DocumentRequest,
) {
  return requestRepository.claimForCancellation(
    requestId,
    cancelledState,
  );
}

export async function deleteRequestSession(
  requestId: string,
) {
  return requestRepository.delete(
    requestId,
  );
}
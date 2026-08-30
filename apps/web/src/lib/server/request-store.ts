import {
  createEmptyDocumentRequest,
  DocumentRequest,
} from "@/lib/request-types";

import {
  requestRepository,
} from "@/lib/server/memory-request-repository";

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

export async function saveRequestSession(
  requestId: string,
  requestState: DocumentRequest,
) {
  return requestRepository.save(
    requestId,
    requestState,
  );
}

export async function deleteRequestSession(
  requestId: string,
) {
  return requestRepository.delete(
    requestId,
  );
}
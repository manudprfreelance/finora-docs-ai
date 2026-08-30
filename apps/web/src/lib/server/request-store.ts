import { randomUUID } from "crypto";

import {
  createEmptyDocumentRequest,
  DocumentRequest,
} from "@/lib/request-types";

interface StoredRequest {
  requestId: string;
  requestState: DocumentRequest;
  createdAt: string;
  updatedAt: string;
}

const requestStore = new Map<string, StoredRequest>();

export function createRequestSession(): StoredRequest {
  const requestId = randomUUID();

  const now = new Date().toISOString();

  const storedRequest: StoredRequest = {
    requestId,
    requestState: createEmptyDocumentRequest(),
    createdAt: now,
    updatedAt: now,
  };

  requestStore.set(requestId, storedRequest);

  return storedRequest;
}

export function getRequestSession(
  requestId: string,
): StoredRequest | null {
  return requestStore.get(requestId) ?? null;
}

export function saveRequestSession(
  requestId: string,
  requestState: DocumentRequest,
): StoredRequest {
  const existingRequest = requestStore.get(requestId);

  const now = new Date().toISOString();

  const storedRequest: StoredRequest = {
    requestId,
    requestState,
    createdAt:
      existingRequest?.createdAt ?? now,
    updatedAt: now,
  };

  requestStore.set(requestId, storedRequest);

  return storedRequest;
}

export function deleteRequestSession(
  requestId: string,
): boolean {
  return requestStore.delete(requestId);
}
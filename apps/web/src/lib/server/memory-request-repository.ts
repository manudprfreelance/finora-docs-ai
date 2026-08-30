import { randomUUID } from "crypto";

import { DocumentRequest } from "@/lib/request-types";

import {
  RequestRepository,
  StoredRequest,
} from "@/lib/server/request-repository";

export class MemoryRequestRepository
  implements RequestRepository
{
  private readonly requests =
    new Map<string, StoredRequest>();

  async create(
    requestState: DocumentRequest,
  ): Promise<StoredRequest> {
    const requestId = randomUUID();
    const now = new Date().toISOString();

    const storedRequest: StoredRequest = {
      requestId,
      requestState,
      createdAt: now,
      updatedAt: now,
    };

    this.requests.set(
      requestId,
      storedRequest,
    );

    return storedRequest;
  }

  async findById(
    requestId: string,
  ): Promise<StoredRequest | null> {
    return (
      this.requests.get(requestId) ??
      null
    );
  }

  async save(
    requestId: string,
    requestState: DocumentRequest,
  ): Promise<StoredRequest> {
    const existingRequest =
      this.requests.get(requestId);

    const now = new Date().toISOString();

    const storedRequest: StoredRequest = {
      requestId,
      requestState,
      createdAt:
        existingRequest?.createdAt ??
        now,
      updatedAt: now,
    };

    this.requests.set(
      requestId,
      storedRequest,
    );

    return storedRequest;
  }

  async delete(
    requestId: string,
  ): Promise<boolean> {
    return this.requests.delete(
      requestId,
    );
  }
}

export const requestRepository =
  new MemoryRequestRepository();
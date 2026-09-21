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

  async findByCustomerId(
    customerId: string,
  ): Promise<StoredRequest[]> {
    return Array.from(
      this.requests.values(),
    )
      .filter(
        (storedRequest) =>
          storedRequest.requestState
            .customer.customerId ===
          customerId,
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt,
          ).getTime() -
          new Date(
            a.createdAt,
          ).getTime(),
      );
  }

  async findManualRequests(): Promise<
    StoredRequest[]
  > {
    return Array.from(
      this.requests.values(),
    )
      .filter((storedRequest) => {
        const requestState =
          storedRequest.requestState;

        const isManualStatus =
          requestState.status ===
            "pending_manual_processing" ||
          requestState.status ===
            "manual_processing";

        const isManualDocument =
          requestState.documentType ===
            "unknown" &&
          requestState.manualRequest !==
            null;

        return (
          isManualStatus &&
          isManualDocument
        );
      })
      .sort(
        (a, b) =>
          new Date(
            a.createdAt,
          ).getTime() -
          new Date(
            b.createdAt,
          ).getTime(),
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

  async claimForConfirmation(
    requestId: string,
    confirmedState: DocumentRequest,
  ): Promise<StoredRequest | null> {
    const existingRequest =
      this.requests.get(requestId);

    if (
      !existingRequest ||
      existingRequest.requestState.status !==
        "ready_for_confirmation"
    ) {
      return null;
    }

    const storedRequest: StoredRequest = {
      requestId,
      requestState: confirmedState,
      createdAt:
        existingRequest.createdAt,
      updatedAt:
        new Date().toISOString(),
    };

    this.requests.set(
      requestId,
      storedRequest,
    );

    return storedRequest;
  }

  async claimForProcessing(
    requestId: string,
    processingState: DocumentRequest,
  ): Promise<StoredRequest | null> {
    const existingRequest =
      this.requests.get(requestId);

    if (
      !existingRequest ||
      existingRequest.requestState.status !==
        "confirmed"
    ) {
      return null;
    }

    const storedRequest: StoredRequest = {
      requestId,
      requestState: processingState,
      createdAt:
        existingRequest.createdAt,
      updatedAt:
        new Date().toISOString(),
    };

    this.requests.set(
      requestId,
      storedRequest,
    );

    return storedRequest;
  }

  async claimForCancellation(
    requestId: string,
    cancelledState: DocumentRequest,
  ): Promise<StoredRequest | null> {
    const existingRequest =
      this.requests.get(requestId);

    if (!existingRequest) {
      return null;
    }

    const cancellableStatuses:
      DocumentRequest["status"][] = [
        "collecting_information",
        "ready_for_confirmation",
        "confirmed",
        "pending_manual_processing",
      ];

    if (
      !cancellableStatuses.includes(
        existingRequest.requestState.status,
      )
    ) {
      return null;
    }

    const storedRequest: StoredRequest = {
      requestId,
      requestState: cancelledState,
      createdAt:
        existingRequest.createdAt,
      updatedAt:
        new Date().toISOString(),
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
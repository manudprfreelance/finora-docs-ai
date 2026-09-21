import { DocumentRequest } from "@/lib/request-types";

export interface StoredRequest {
  requestId: string;
  requestState: DocumentRequest;
  createdAt: string;
  updatedAt: string;
}

export interface RequestRepository {
  create(
    requestState: DocumentRequest,
  ): Promise<StoredRequest>;

  findById(
    requestId: string,
  ): Promise<StoredRequest | null>;

  findByCustomerId(
    customerId: string,
  ): Promise<StoredRequest[]>;

  save(
    requestId: string,
    requestState: DocumentRequest,
  ): Promise<StoredRequest>;

  claimForConfirmation(
    requestId: string,
    confirmedState: DocumentRequest,
  ): Promise<StoredRequest | null>;

  claimForProcessing(
    requestId: string,
    processingState: DocumentRequest,
  ): Promise<StoredRequest | null>;

  claimForCancellation(
    requestId: string,
    cancelledState: DocumentRequest,
  ): Promise<StoredRequest | null>;

  delete(
    requestId: string,
  ): Promise<boolean>;
}
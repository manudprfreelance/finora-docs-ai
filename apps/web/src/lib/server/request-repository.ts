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

  save(
    requestId: string,
    requestState: DocumentRequest,
  ): Promise<StoredRequest>;

  delete(
    requestId: string,
  ): Promise<boolean>;
}
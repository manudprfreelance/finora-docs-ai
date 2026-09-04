import {
  DocumentRequest,
} from "@/lib/request-types";

export type DocumentProcessingStatus =
  | "completed"
  | "failed";

export interface DocumentProcessingResult {
  requestId: string;
  status: DocumentProcessingStatus;
  provider: string;
  externalReference: string | null;
  output: Record<string, unknown>;
  error: string | null;
}

export interface DocumentProcessingService {
  process(
    requestId: string,
    requestState: DocumentRequest,
  ): Promise<DocumentProcessingResult>;
}
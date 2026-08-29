export type DocumentType =
  | "account_statement"
  | "position_statement"
  | "loan_amortization"
  | "swift_confirmation"
  | "unknown";

export type RequestStatus =
  | "collecting_information"
  | "ready_for_confirmation"
  | "confirmed"
  | "processing"
  | "completed"
  | "failed";

export interface CustomerIdentity {
  customerId: string | null;
  dni: string | null;
  name: string | null;
}

export interface CustomerAccount {
  accountId: string;
  accountName: string;
  maskedAccountNumber: string;
  accountType: string;
}

export interface DateRange {
  from: string | null;
  to: string | null;
}

export type MissingField =
  | "dni"
  | "name"
  | "documentType"
  | "account"
  | "dateRange";

export interface DocumentRequest {
  /**
   * Original natural-language request written by the customer.
   */
  originalRequest: string;

  /**
   * Customer identity resolved during the conversation.
   *
   * In the final architecture this information can be completed
   * or validated against the bank's customer database.
   */
  customer: CustomerIdentity;

  /**
   * Document type identified from the customer's request.
   */
  documentType: DocumentType;

  /**
   * Accounts retrieved for the identified customer.
   *
   * These should eventually come from the backend/database,
   * not from values hardcoded in the frontend.
   */
  availableAccounts: CustomerAccount[];

  /**
   * Account selected or confirmed during the conversation.
   */
  selectedAccount: CustomerAccount | null;

  /**
   * Requested document period, when applicable.
   */
  dateRange: DateRange | null;

  /**
   * Information that still needs to be obtained before
   * the request can be confirmed.
   */
  missingFields: MissingField[];

  status: RequestStatus;
}

export const createEmptyDocumentRequest = (): DocumentRequest => ({
  originalRequest: "",

  customer: {
    customerId: null,
    dni: null,
    name: null,
  },

  documentType: "unknown",

  availableAccounts: [],

  selectedAccount: null,

  dateRange: null,

  missingFields: ["dni", "name", "documentType"],

  status: "collecting_information",
});
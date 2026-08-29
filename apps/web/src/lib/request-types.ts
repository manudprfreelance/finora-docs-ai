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

export interface CustomerLoan {
  loanId: string;
  loanName: string;
  maskedLoanNumber: string;
  loanType: string;
}

export interface BankMovement {
  movementId: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
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
  | "dateRange"
  | "loan"
  | "movement";

export interface DocumentRequest {
  /**
   * Original natural-language request written by the customer.
   */
  originalRequest: string;

  /**
   * Customer identity resolved during the conversation.
   */
  customer: CustomerIdentity;

  /**
   * Document type identified from the customer's request.
   */
  documentType: DocumentType;

  /**
   * Accounts retrieved from the bank data source.
   */
  availableAccounts: CustomerAccount[];

  /**
   * Account selected or inferred for the request.
   */
  selectedAccount: CustomerAccount | null;

  /**
   * Loans retrieved for the identified customer.
   */
  availableLoans: CustomerLoan[];

  /**
   * Loan selected or inferred for the request.
   */
  selectedLoan: CustomerLoan | null;

  /**
   * Movements retrieved for the relevant account.
   */
  availableMovements: BankMovement[];

  /**
   * Movement selected or inferred for a SWIFT confirmation.
   */
  selectedMovement: BankMovement | null;

  /**
   * Requested document period, when applicable.
   */
  dateRange: DateRange | null;

  /**
   * Information still required before confirmation.
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

  availableLoans: [],
  selectedLoan: null,

  availableMovements: [],
  selectedMovement: null,

  dateRange: null,

  missingFields: ["dni", "name", "documentType"],

  status: "collecting_information",
});
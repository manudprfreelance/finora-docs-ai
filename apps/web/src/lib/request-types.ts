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

export type CustomerResolutionStatus =
  | "unresolved"
  | "resolved"
  | "not_found";

export interface CustomerIdentity {
  customerId: string | null;
  dni: string | null;
  name: string | null;
  resolutionStatus: CustomerResolutionStatus;
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
  | "customer"
  | "documentType"
  | "account"
  | "dateRange"
  | "loan"
  | "movement";

export interface DocumentRequest {
  originalRequest: string;

  customer: CustomerIdentity;

  documentType: DocumentType;

  availableAccounts: CustomerAccount[];
  selectedAccount: CustomerAccount | null;

  availableLoans: CustomerLoan[];
  selectedLoan: CustomerLoan | null;

  availableMovements: BankMovement[];
  selectedMovement: BankMovement | null;

  dateRange: DateRange | null;

  missingFields: MissingField[];

  status: RequestStatus;
}

export const createEmptyDocumentRequest = (): DocumentRequest => ({
  originalRequest: "",

  customer: {
    customerId: null,
    dni: null,
    name: null,
    resolutionStatus: "unresolved",
  },

  documentType: "unknown",

  availableAccounts: [],
  selectedAccount: null,

  availableLoans: [],
  selectedLoan: null,

  availableMovements: [],
  selectedMovement: null,

  dateRange: null,

  missingFields: ["dni", "documentType"],

  status: "collecting_information",
});
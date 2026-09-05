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

export type LoanPaymentFrequency =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual";

export interface LoanFinancialDetails {
  currency: string;

  originalPrincipal: number;

  outstandingPrincipal: number;

  annualInterestRate: number;

  startDate: string;

  maturityDate: string;

  paymentFrequency: LoanPaymentFrequency;

  totalInstallments: number;

  paidInstallments: number;

  installmentAmount: number;
}

export interface CustomerLoan {
  loanId: string;

  loanName: string;

  maskedLoanNumber: string;

  loanType: string;

  financialDetails?: LoanFinancialDetails;
}

export interface SwiftTransferDetails {
  /*
   * Identificador único de seguimiento
   * de la transferencia.
   */
  uetr: string;

  /*
   * Referencia bancaria de la operación.
   */
  transactionReference: string;

  /*
   * Datos del ordenante.
   */
  orderingCustomerName: string;

  orderingAccount:
    string;

  /*
   * Datos del beneficiario.
   */
  beneficiaryName: string;

  beneficiaryIban: string;

  /*
   * Banco receptor.
   */
  beneficiaryBankName: string;

  beneficiaryBankBic: string;

  beneficiaryBankCountry: string;

  /*
   * Concepto enviado con la transferencia.
   */
  remittanceInformation: string;

  /*
   * Fecha valor bancaria.
   */
  valueDate: string;

  /*
   * Modalidad de gastos SWIFT.
   *
   * SHA = gastos compartidos
   * OUR = gastos a cargo del ordenante
   * BEN = gastos a cargo del beneficiario
   */
  charges: "SHA" | "OUR" | "BEN";

  /*
   * Estado operativo de la transferencia.
   */
  transferStatus:
    | "processed"
    | "settled"
    | "pending";
}

export interface BankMovement {
  movementId: string;

  accountId: string;

  date: string;

  description: string;

  amount: number;

  currency: string;

  /*
   * Solo existe para movimientos que
   * representan transferencias
   * internacionales susceptibles de
   * generar una confirmación SWIFT.
   */
  swiftDetails?: SwiftTransferDetails;
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

export const createEmptyDocumentRequest =
  (): DocumentRequest => ({
    originalRequest: "",

    customer: {
      customerId: null,

      dni: null,

      name: null,

      resolutionStatus:
        "unresolved",
    },

    documentType: "unknown",

    availableAccounts: [],

    selectedAccount: null,

    availableLoans: [],

    selectedLoan: null,

    availableMovements: [],

    selectedMovement: null,

    dateRange: null,

    missingFields: [
      "dni",
      "documentType",
    ],

    status:
      "collecting_information",
  });
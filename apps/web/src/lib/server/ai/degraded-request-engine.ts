import {
  BankMovement,
  CustomerAccount,
  CustomerLoan,
  DocumentRequest,
  DocumentType,
} from "@/lib/request-types";

import {
  resolveCustomerFromDni,
  updateRequestStatus,
} from "@/lib/request-engine";

export interface DegradedRequestInput {
  documentType: DocumentType;

  dni: string;

  accountId?: string | null;

  loanId?: string | null;

  movementId?: string | null;

  dateFrom?: string | null;

  dateTo?: string | null;
}

export interface DegradedRequestResult {
  requestState: DocumentRequest;

  validationErrors: string[];
}

const supportedDegradedDocumentTypes:
  DocumentType[] = [
    "account_statement",
    "position_statement",
    "loan_amortization",
    "swift_confirmation",
  ];

function normalizeOptionalValue(
  value: string | null | undefined,
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized.length > 0
    ? normalized
    : null;
}

function requiresAccount(
  documentType: DocumentType,
): boolean {
  return (
    documentType ===
      "account_statement" ||
    documentType ===
      "position_statement" ||
    documentType ===
      "swift_confirmation"
  );
}

function requiresDateRange(
  documentType: DocumentType,
): boolean {
  return (
    documentType ===
      "account_statement" ||
    documentType ===
      "position_statement"
  );
}

function requiresLoan(
  documentType: DocumentType,
): boolean {
  return (
    documentType ===
    "loan_amortization"
  );
}

function requiresMovement(
  documentType: DocumentType,
): boolean {
  return (
    documentType ===
    "swift_confirmation"
  );
}

function findAccount(
  request: DocumentRequest,
  accountId: string | null,
): CustomerAccount | null {
  if (!accountId) {
    return null;
  }

  return (
    request.availableAccounts.find(
      (account) =>
        account.accountId ===
        accountId,
    ) ?? null
  );
}

function findLoan(
  request: DocumentRequest,
  loanId: string | null,
): CustomerLoan | null {
  if (!loanId) {
    return null;
  }

  return (
    request.availableLoans.find(
      (loan) =>
        loan.loanId === loanId,
    ) ?? null
  );
}

function findMovement(
  request: DocumentRequest,
  movementId: string | null,
  selectedAccount:
    CustomerAccount | null,
): BankMovement | null {
  if (!movementId) {
    return null;
  }

  const movement =
    request.availableMovements.find(
      (candidate) =>
        candidate.movementId ===
        movementId,
    ) ?? null;

  if (!movement) {
    return null;
  }

  if (
    selectedAccount &&
    movement.accountId !==
      selectedAccount.accountId
  ) {
    return null;
  }

  return movement;
}

function isValidIsoDate(
  value: string,
): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value,
  );
}

function validateDateRange(
  from: string | null,
  to: string | null,
): string[] {
  const errors: string[] = [];

  if (!from || !to) {
    errors.push(
      "Debes indicar la fecha inicial y la fecha final.",
    );

    return errors;
  }

  if (
    !isValidIsoDate(from) ||
    !isValidIsoDate(to)
  ) {
    errors.push(
      "Las fechas deben tener el formato AAAA-MM-DD.",
    );

    return errors;
  }

  if (from > to) {
    errors.push(
      "La fecha inicial no puede ser posterior a la fecha final.",
    );
  }

  return errors;
}

export function applyDegradedRequestInput(
  currentRequest: DocumentRequest,
  input: DegradedRequestInput,
): DegradedRequestResult {
  const validationErrors:
    string[] = [];

  const dni =
    input.dni
      .trim()
      .toUpperCase();

  if (!dni) {
    return {
      requestState:
        updateRequestStatus(
          currentRequest,
        ),

      validationErrors: [
        "Debes indicar el DNI del cliente.",
      ],
    };
  }

  if (
    !supportedDegradedDocumentTypes.includes(
      input.documentType,
    )
  ) {
    return {
      requestState:
        updateRequestStatus(
          currentRequest,
        ),

      validationErrors: [
        "Debes seleccionar un tipo de documento válido.",
      ],
    };
  }

  /*
   * La identidad nunca se confía al
   * navegador. El DNI se resuelve de
   * nuevo contra los datos bancarios
   * disponibles en el servidor.
   */
  let nextRequest =
    resolveCustomerFromDni(
      {
        ...currentRequest,

        documentType:
          input.documentType,

        /*
         * En modo degradado el texto
         * libre deja de ser la fuente
         * de extracción. Conservamos el
         * original para auditoría.
         */
        originalRequest:
          currentRequest
            .originalRequest,

        selectedAccount: null,

        selectedLoan: null,

        selectedMovement: null,

        dateRange: null,
      },
      dni,
    );

  if (
    nextRequest.customer
      .resolutionStatus !==
    "resolved"
  ) {
    return {
      requestState:
        nextRequest,

      validationErrors: [
        "No se ha encontrado ningún cliente asociado al DNI indicado.",
      ],
    };
  }

  const accountId =
    normalizeOptionalValue(
      input.accountId,
    );

  const loanId =
    normalizeOptionalValue(
      input.loanId,
    );

  const movementId =
    normalizeOptionalValue(
      input.movementId,
    );

  const dateFrom =
    normalizeOptionalValue(
      input.dateFrom,
    );

  const dateTo =
    normalizeOptionalValue(
      input.dateTo,
    );

  let selectedAccount:
    CustomerAccount | null =
      null;

  let selectedLoan:
    CustomerLoan | null =
      null;

  let selectedMovement:
    BankMovement | null =
      null;

  if (
    requiresAccount(
      input.documentType,
    )
  ) {
    selectedAccount =
      findAccount(
        nextRequest,
        accountId,
      );

    if (!accountId) {
      validationErrors.push(
        "Debes seleccionar una cuenta.",
      );
    } else if (
      !selectedAccount
    ) {
      validationErrors.push(
        "La cuenta seleccionada no pertenece al cliente.",
      );
    }
  }

  if (
    requiresLoan(
      input.documentType,
    )
  ) {
    selectedLoan =
      findLoan(
        nextRequest,
        loanId,
      );

    if (!loanId) {
      validationErrors.push(
        "Debes seleccionar un préstamo.",
      );
    } else if (
      !selectedLoan
    ) {
      validationErrors.push(
        "El préstamo seleccionado no pertenece al cliente.",
      );
    }
  }

  if (
    requiresMovement(
      input.documentType,
    )
  ) {
    selectedMovement =
      findMovement(
        nextRequest,
        movementId,
        selectedAccount,
      );

    if (!movementId) {
      validationErrors.push(
        "Debes seleccionar una operación SWIFT.",
      );
    } else if (
      !selectedMovement
    ) {
      validationErrors.push(
        "La operación seleccionada no es válida para la cuenta indicada.",
      );
    } else if (
      !selectedMovement
        .swiftDetails
    ) {
      validationErrors.push(
        "La operación seleccionada no dispone de información SWIFT.",
      );

      selectedMovement =
        null;
    }
  }

  if (
    requiresDateRange(
      input.documentType,
    )
  ) {
    validationErrors.push(
      ...validateDateRange(
        dateFrom,
        dateTo,
      ),
    );
  }

  /*
   * Aplicamos únicamente objetos que
   * han sido recuperados de los datos
   * bancarios del servidor. El cliente
   * nunca puede enviar una cuenta,
   * préstamo u operación arbitrarios.
   */
  nextRequest =
    updateRequestStatus({
      ...nextRequest,

      documentType:
        input.documentType,

      selectedAccount,

      selectedLoan,

      selectedMovement,

      dateRange:
        requiresDateRange(
          input.documentType,
        )
          ? {
              from: dateFrom,
              to: dateTo,
            }
          : null,
    });

  return {
    requestState:
      nextRequest,

    validationErrors,
  };
}
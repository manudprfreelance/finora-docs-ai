import {
  DocumentRequest,
  DocumentType,
  MissingField,
} from "@/lib/request-types";

import {
  findCustomerByDni,
  getCustomerAccounts,
} from "@/lib/mock-bank-data";

function requiresAccount(documentType: DocumentType): boolean {
  return (
    documentType === "account_statement" ||
    documentType === "position_statement" ||
    documentType === "swift_confirmation"
  );
}

function requiresDateRange(documentType: DocumentType): boolean {
  return (
    documentType === "account_statement" ||
    documentType === "position_statement"
  );
}

export function calculateMissingFields(
  request: DocumentRequest,
): MissingField[] {
  const missingFields: MissingField[] = [];

  if (!request.customer.dni?.trim()) {
    missingFields.push("dni");
  }

  if (!request.customer.name?.trim()) {
    missingFields.push("name");
  }

  if (request.documentType === "unknown") {
    missingFields.push("documentType");
  }

  if (
    requiresAccount(request.documentType) &&
    !request.selectedAccount
  ) {
    missingFields.push("account");
  }

  if (requiresDateRange(request.documentType)) {
    const hasDateRange =
      request.dateRange?.from?.trim() &&
      request.dateRange?.to?.trim();

    if (!hasDateRange) {
      missingFields.push("dateRange");
    }
  }

  return missingFields;
}

export function isRequestReadyForConfirmation(
  request: DocumentRequest,
): boolean {
  return calculateMissingFields(request).length === 0;
}

export function updateRequestStatus(
  request: DocumentRequest,
): DocumentRequest {
  const missingFields = calculateMissingFields(request);

  return {
    ...request,
    missingFields,
    status:
      missingFields.length === 0
        ? "ready_for_confirmation"
        : "collecting_information",
  };
}

export function resolveCustomerFromDni(
  request: DocumentRequest,
  dni: string,
): DocumentRequest {
  const customer = findCustomerByDni(dni);

  if (!customer) {
    return updateRequestStatus({
      ...request,
      customer: {
        customerId: null,
        dni: dni.trim().toUpperCase(),
        name: null,
      },
      availableAccounts: [],
      selectedAccount: null,
    });
  }

  const accounts = getCustomerAccounts(customer.customerId);

  return updateRequestStatus({
    ...request,
    customer: {
      customerId: customer.customerId,
      dni: customer.dni,
      name: customer.name,
    },
    availableAccounts: accounts,
    selectedAccount:
      accounts.length === 1 ? accounts[0] : request.selectedAccount,
  });
}
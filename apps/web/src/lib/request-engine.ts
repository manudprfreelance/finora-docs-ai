import {
  DocumentRequest,
  DocumentType,
  MissingField,
} from "@/lib/request-types";

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
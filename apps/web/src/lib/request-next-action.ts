import { DocumentRequest } from "@/lib/request-types";

export type NextActionType =
  | "ask_dni"
  | "ask_document_type"
  | "ask_account"
  | "ask_date_range"
  | "confirm_request";

export interface NextAction {
  type: NextActionType;
  message: string;
}

export function getNextAction(
  request: DocumentRequest,
): NextAction {
  if (request.missingFields.includes("dni")) {
    return {
      type: "ask_dni",
      message: "Please provide your DNI so I can identify your profile.",
    };
  }

  if (request.missingFields.includes("documentType")) {
    return {
      type: "ask_document_type",
      message:
        "What document do you need? You can describe it in your own words.",
    };
  }

  if (
    request.missingFields.includes("account") &&
    request.availableAccounts.length > 1
  ) {
    const accountOptions = request.availableAccounts
      .map(
        (account) =>
          `${account.accountName} ${account.maskedAccountNumber}`,
      )
      .join(", ");

    return {
      type: "ask_account",
      message: `I found several accounts associated with your profile: ${accountOptions}. Which one should I use for this request?`,
    };
  }

  if (request.missingFields.includes("account")) {
    return {
      type: "ask_account",
      message:
        "I still need to identify which account should be used for this request.",
    };
  }

  if (request.missingFields.includes("dateRange")) {
    return {
      type: "ask_date_range",
      message:
        "What date range should be included in the document?",
    };
  }

  return {
    type: "confirm_request",
    message:
      "I have all the required information. Please review and confirm the request.",
  };
}
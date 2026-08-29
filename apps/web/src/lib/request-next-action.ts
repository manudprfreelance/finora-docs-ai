import { DocumentRequest } from "@/lib/request-types";

export type NextActionType =
  | "ask_dni"
  | "customer_not_found"
  | "ask_document_type"
  | "ask_account"
  | "ask_date_range"
  | "ask_loan"
  | "ask_movement"
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
      message:
        "Por favor, indícame tu DNI para poder identificar tu perfil.",
    };
  }

  if (
    request.customer.resolutionStatus === "not_found"
  ) {
    return {
      type: "customer_not_found",
      message: `No he encontrado ningún cliente asociado al DNI ${request.customer.dni}. Comprueba que esté escrito correctamente y vuelve a indicármelo.`,
    };
  }

  if (request.missingFields.includes("customer")) {
    return {
      type: "customer_not_found",
      message:
        "No he podido identificar tu perfil. Comprueba el DNI e inténtalo de nuevo.",
    };
  }

  if (request.missingFields.includes("documentType")) {
    return {
      type: "ask_document_type",
      message:
        "¿Qué documento necesitas? Puedes explicármelo con tus propias palabras.",
    };
  }

  if (request.missingFields.includes("account")) {
    if (request.availableAccounts.length > 1) {
      const accountOptions = request.availableAccounts
        .map(
          (account) =>
            `${account.accountName} ${account.maskedAccountNumber}`,
        )
        .join(", ");

      return {
        type: "ask_account",
        message: `He encontrado varias cuentas asociadas a tu perfil: ${accountOptions}. ¿Cuál quieres utilizar para esta solicitud?`,
      };
    }

    return {
      type: "ask_account",
      message:
        "Necesito identificar qué cuenta debemos utilizar para esta solicitud.",
    };
  }

  if (request.missingFields.includes("loan")) {
    if (request.availableLoans.length > 1) {
      const loanOptions = request.availableLoans
        .map(
          (loan) =>
            `${loan.loanName} ${loan.maskedLoanNumber}`,
        )
        .join(", ");

      return {
        type: "ask_loan",
        message: `He encontrado varios préstamos asociados a tu perfil: ${loanOptions}. ¿Para cuál necesitas el cuadro de amortización?`,
      };
    }

    return {
      type: "ask_loan",
      message:
        "Necesito identificar para qué préstamo necesitas el cuadro de amortización.",
    };
  }

  if (request.missingFields.includes("movement")) {
    if (request.availableMovements.length > 0) {
      return {
        type: "ask_movement",
        message:
          "¿De qué operación necesitas la confirmación SWIFT? Puedes indicarme la fecha, el importe o el beneficiario.",
      };
    }

    return {
      type: "ask_movement",
      message:
        "No he podido identificar la operación necesaria para generar la confirmación SWIFT.",
    };
  }

  if (request.missingFields.includes("dateRange")) {
    return {
      type: "ask_date_range",
      message:
        "¿Qué periodo de fechas quieres que incluya el documento?",
    };
  }

  return {
    type: "confirm_request",
    message:
      "Ya tengo toda la información necesaria. Revisa los datos y confirma la solicitud.",
  };
}
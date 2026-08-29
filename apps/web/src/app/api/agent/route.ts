import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

import {
  createEmptyDocumentRequest,
  DocumentRequest,
  DocumentType,
} from "@/lib/request-types";

import {
  resolveCustomerFromDni,
  updateRequestStatus,
} from "@/lib/request-engine";

import { getNextAction } from "@/lib/request-next-action";

interface AgentRequestBody {
  message?: string;
  requestState?: DocumentRequest | null;
}

interface AgentExtraction {
  documentType: DocumentType;
  dni: string | null;
  accountLast4: string | null;
  loanLast4: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  movementDate: string | null;
  movementAmount: number | null;
  movementBeneficiary: string | null;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseExtraction(output: string): AgentExtraction {
  const cleanedOutput = output
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(
    cleanedOutput,
  ) as Partial<AgentExtraction>;

  const allowedDocumentTypes: DocumentType[] = [
    "account_statement",
    "position_statement",
    "loan_amortization",
    "swift_confirmation",
    "unknown",
  ];

  const documentType = allowedDocumentTypes.includes(
    parsed.documentType as DocumentType,
  )
    ? (parsed.documentType as DocumentType)
    : "unknown";

  return {
    documentType,

    dni:
      typeof parsed.dni === "string" && parsed.dni.trim()
        ? parsed.dni.trim().toUpperCase()
        : null,

    accountLast4:
      typeof parsed.accountLast4 === "string" &&
      parsed.accountLast4.trim()
        ? parsed.accountLast4.trim()
        : null,

    loanLast4:
      typeof parsed.loanLast4 === "string" &&
      parsed.loanLast4.trim()
        ? parsed.loanLast4.trim()
        : null,

    dateFrom:
      typeof parsed.dateFrom === "string" &&
      parsed.dateFrom.trim()
        ? parsed.dateFrom.trim()
        : null,

    dateTo:
      typeof parsed.dateTo === "string" &&
      parsed.dateTo.trim()
        ? parsed.dateTo.trim()
        : null,

    movementDate:
      typeof parsed.movementDate === "string" &&
      parsed.movementDate.trim()
        ? parsed.movementDate.trim()
        : null,

    movementAmount:
      typeof parsed.movementAmount === "number"
        ? parsed.movementAmount
        : null,

    movementBeneficiary:
      typeof parsed.movementBeneficiary === "string" &&
      parsed.movementBeneficiary.trim()
        ? parsed.movementBeneficiary.trim()
        : null,
  };
}

function applyExtraction(
  currentRequest: DocumentRequest,
  extraction: AgentExtraction,
  message: string,
): DocumentRequest {
  let documentRequest: DocumentRequest = {
    ...currentRequest,

    customer: {
      ...currentRequest.customer,
    },

    availableAccounts: [
      ...currentRequest.availableAccounts,
    ],

    availableLoans: [
      ...currentRequest.availableLoans,
    ],

    availableMovements: [
      ...currentRequest.availableMovements,
    ],

    dateRange: currentRequest.dateRange
      ? {
          ...currentRequest.dateRange,
        }
      : null,

    originalRequest:
      currentRequest.originalRequest || message,
  };

  /*
   * Never replace an already-known document type with "unknown".
   */
  if (extraction.documentType !== "unknown") {
    documentRequest = {
      ...documentRequest,
      documentType: extraction.documentType,
    };
  }

  /*
   * Resolve the customer while preserving everything already learned
   * during previous conversation turns.
   */
  if (
    extraction.dni &&
    extraction.dni !== documentRequest.customer.dni
  ) {
    const preservedDocumentType =
      documentRequest.documentType;

    const preservedDateRange =
      documentRequest.dateRange;

    const preservedOriginalRequest =
      documentRequest.originalRequest;

    documentRequest = resolveCustomerFromDni(
      documentRequest,
      extraction.dni,
    );

    documentRequest = {
      ...documentRequest,
      documentType: preservedDocumentType,
      dateRange: preservedDateRange,
      originalRequest: preservedOriginalRequest,
    };
  }

  /*
   * Select an account from the accounts retrieved from bank data.
   */
  if (extraction.accountLast4) {
    const selectedAccount =
      documentRequest.availableAccounts.find((account) =>
        account.maskedAccountNumber.endsWith(
          extraction.accountLast4 ?? "",
        ),
      ) ?? null;

    if (selectedAccount) {
      documentRequest = {
        ...documentRequest,
        selectedAccount,
      };
    }
  }

  /*
   * Select a loan when applicable.
   */
  if (extraction.loanLast4) {
    const selectedLoan =
      documentRequest.availableLoans.find((loan) =>
        loan.maskedLoanNumber.endsWith(
          extraction.loanLast4 ?? "",
        ),
      ) ?? null;

    if (selectedLoan) {
      documentRequest = {
        ...documentRequest,
        selectedLoan,
      };
    }
  }

  /*
   * Merge date information instead of replacing previously known dates.
   */
  if (extraction.dateFrom || extraction.dateTo) {
    documentRequest = {
      ...documentRequest,

      dateRange: {
        from:
          extraction.dateFrom ??
          documentRequest.dateRange?.from ??
          null,

        to:
          extraction.dateTo ??
          documentRequest.dateRange?.to ??
          null,
      },
    };
  }

  /*
   * Try to identify a bank movement for SWIFT confirmations.
   */
  if (
    extraction.movementDate ||
    extraction.movementAmount !== null ||
    extraction.movementBeneficiary
  ) {
    const possibleMovements =
      documentRequest.selectedAccount
        ? documentRequest.availableMovements.filter(
            (movement) =>
              movement.accountId ===
              documentRequest.selectedAccount?.accountId,
          )
        : documentRequest.availableMovements;

    const selectedMovement =
      possibleMovements.find((movement) => {
        const matchesDate =
          !extraction.movementDate ||
          movement.date === extraction.movementDate;

        const matchesAmount =
          extraction.movementAmount === null ||
          Math.abs(movement.amount) ===
            Math.abs(extraction.movementAmount);

        const matchesBeneficiary =
          !extraction.movementBeneficiary ||
          movement.description
            .toLowerCase()
            .includes(
              extraction.movementBeneficiary.toLowerCase(),
            );

        return (
          matchesDate &&
          matchesAmount &&
          matchesBeneficiary
        );
      }) ?? null;

    if (selectedMovement) {
      documentRequest = {
        ...documentRequest,
        selectedMovement,
      };
    }
  }

  return updateRequestStatus(documentRequest);
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "OpenAI API key is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    const body =
      (await request.json()) as AgentRequestBody;

    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        {
          error: "El mensaje es obligatorio.",
        },
        {
          status: 400,
        },
      );
    }

    const currentRequest =
      body.requestState ?? createEmptyDocumentRequest();

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",

      instructions: `
You are the natural-language understanding layer of Finora Docs AI,
a Spanish banking document request assistant.

The customer communicates in Spanish.

Your job is ONLY to extract structured information from the latest
customer message. Do not answer the customer.

Current date: ${today}

Supported document types:

- account_statement:
  account statement, bank statement, account extract, extracto de cuenta,
  movimientos or transactions for a period.

- position_statement:
  statement or certificate showing balances, holdings, investment
  positions or financial position.

- loan_amortization:
  loan or mortgage amortization schedule, cuadro de amortización.

- swift_confirmation:
  SWIFT confirmation, justificante SWIFT or proof of an international
  bank transfer.

- unknown:
  only when the document cannot be reliably identified from this message.

Extract a Spanish DNI only if explicitly provided.

If the customer identifies an account by its final digits,
extract exactly those final 4 digits.

If the customer identifies a loan by its final digits,
extract exactly those final 4 digits.

For date ranges:
- convert dates to YYYY-MM-DD when they can be understood reliably;
- do not invent dates;
- use null when a boundary cannot be determined.

For transfer movements:
- extract date if explicitly identifiable;
- extract numeric amount if provided;
- extract beneficiary text if provided.

Do not invent information.

Return ONLY valid JSON.
Do not use Markdown.
Do not add explanations.

Return exactly this JSON shape:

{
  "documentType": "account_statement" | "position_statement" | "loan_amortization" | "swift_confirmation" | "unknown",
  "dni": string | null,
  "accountLast4": string | null,
  "loanLast4": string | null,
  "dateFrom": string | null,
  "dateTo": string | null,
  "movementDate": string | null,
  "movementAmount": number | null,
  "movementBeneficiary": string | null
}
      `.trim(),

      input: message,
    });

    const extraction = parseExtraction(
      response.output_text,
    );

    const documentRequest = applyExtraction(
      currentRequest,
      extraction,
      message,
    );

    const nextAction =
      getNextAction(documentRequest);

    return NextResponse.json({
      receivedMessage: message,

      agent: {
        mode: "openai",
        provider: "openai",
        model: "gpt-5.6-luna",
      },

      extraction,
      requestState: documentRequest,
      nextAction,
    });
  } catch (error) {
    console.error("Agent API error:", error);

    return NextResponse.json(
      {
        error:
          "No se ha podido procesar la solicitud con el agente de IA.",
      },
      {
        status: 500,
      },
    );
  }
}
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

import {
  createEmptyDocumentRequest,
  DocumentType,
} from "@/lib/request-types";

import {
  resolveCustomerFromDni,
  updateRequestStatus,
} from "@/lib/request-engine";

import { getNextAction } from "@/lib/request-next-action";

interface AgentRequestBody {
  message?: string;
}

interface AgentExtraction {
  documentType: DocumentType;
  dni: string | null;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseExtraction(output: string): AgentExtraction {
  const cleanedOutput = output
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(cleanedOutput) as Partial<AgentExtraction>;

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
  };
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

    const body = (await request.json()) as AgentRequestBody;
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

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      instructions: `
You are the natural-language understanding layer of Finora Docs AI,
a financial document request assistant.

Your task is to extract structured information from the customer's message.

Supported document types:

- account_statement:
  bank account statement, account extract, movements or transactions for a period.

- position_statement:
  statement or certificate showing the customer's financial position,
  holdings, balances or investment position.

- loan_amortization:
  loan or mortgage amortization schedule.

- swift_confirmation:
  SWIFT confirmation or proof of an international bank transfer.

- unknown:
  use this when the requested document cannot be identified reliably.

Also extract a Spanish DNI if the customer explicitly provides one.

Do not invent information.

Return ONLY valid JSON.
Do not use Markdown.
Do not add explanations.

The exact JSON shape must be:

{
  "documentType": "account_statement" | "position_statement" | "loan_amortization" | "swift_confirmation" | "unknown",
  "dni": string | null
}
      `.trim(),

      input: message,
    });

    const extraction = parseExtraction(response.output_text);

    let documentRequest = createEmptyDocumentRequest();

    documentRequest = {
      ...documentRequest,
      originalRequest: message,
      documentType: extraction.documentType,
    };

    if (extraction.dni) {
      documentRequest = resolveCustomerFromDni(
        documentRequest,
        extraction.dni,
      );
    } else {
      documentRequest = updateRequestStatus(documentRequest);
    }

    const nextAction = getNextAction(documentRequest);

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
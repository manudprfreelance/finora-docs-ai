import { NextRequest, NextResponse } from "next/server";

import { createEmptyDocumentRequest } from "@/lib/request-types";
import { updateRequestStatus } from "@/lib/request-engine";
import { getNextAction } from "@/lib/request-next-action";

interface AgentRequestBody {
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequestBody;

    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        {
          error: "Message is required.",
        },
        {
          status: 400,
        },
      );
    }

    const documentRequest = updateRequestStatus(
      createEmptyDocumentRequest(),
    );

    const nextAction = getNextAction(documentRequest);

    return NextResponse.json({
      receivedMessage: message,

      agent: {
        mode: "mock",
        provider: "openai-not-connected-yet",
      },

      requestState: documentRequest,

      nextAction,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      {
        status: 400,
      },
    );
  }
}
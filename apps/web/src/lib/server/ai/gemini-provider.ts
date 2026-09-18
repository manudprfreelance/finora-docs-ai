import {
  GoogleGenAI,
} from "@google/genai";

import {
  AIInvalidResponseError,
} from "@/lib/errors";

import {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
} from "@/lib/server/ai/ai-provider";

import {
  mapGeminiError,
} from "@/lib/server/ai/gemini-error-mapper";

export const GEMINI_MODEL =
  "gemini-2.5-flash";

export class GeminiProvider
  implements AIProvider
{
  readonly name = "gemini" as const;
  readonly model = GEMINI_MODEL;

  private readonly client: GoogleGenAI;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY no está configurada.",
      );
    }

    this.client = new GoogleGenAI({
      apiKey,
    });
  }

  async generate(
    request: AIProviderRequest,
  ): Promise<AIProviderResponse> {
    try {
      const response =
        await this.client.models.generateContent({
          model: this.model,

          contents: request.input,

          config: {
            systemInstruction:
              request.instructions,

            responseMimeType:
              "application/json",
          },
        });

      const outputText =
        response.text?.trim() ?? "";

      if (!outputText) {
        throw new AIInvalidResponseError(
          "Gemini ha devuelto una respuesta vacía.",
          {
            details: {
              provider: "gemini",
              reason:
                "empty_response",
            },
          },
        );
      }

      const usageMetadata =
        response.usageMetadata;

      const inputTokens =
        usageMetadata
          ?.promptTokenCount ??
        null;

      const outputTokens =
        usageMetadata
          ?.candidatesTokenCount ??
        null;

      const totalTokens =
        usageMetadata
          ?.totalTokenCount ??
        null;

      return {
        provider: this.name,
        model: this.model,
        outputText,

        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
      };
    } catch (error) {
      throw mapGeminiError(error);
    }
  }
}
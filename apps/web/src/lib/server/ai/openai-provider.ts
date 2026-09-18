import OpenAI from "openai";

import {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
} from "@/lib/server/ai/ai-provider";

import {
  mapOpenAIError,
} from "@/lib/server/ai/openai-error-mapper";

export const OPENAI_MODEL =
  "gpt-5.6-luna";

export class OpenAIProvider
  implements AIProvider
{
  readonly name = "openai" as const;
  readonly model = OPENAI_MODEL;

  private readonly client: OpenAI;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY no está configurada.",
      );
    }

    this.client = new OpenAI({
      apiKey,
    });
  }

  async generate(
    request: AIProviderRequest,
  ): Promise<AIProviderResponse> {
    try {
      const response =
        await this.client.responses.create({
          model: this.model,
          instructions:
            request.instructions,
          input: request.input,
        });

      const inputTokens =
        response.usage?.input_tokens ??
        null;

      const outputTokens =
        response.usage?.output_tokens ??
        null;

      const totalTokens =
        response.usage?.total_tokens ??
        null;

      return {
        provider: this.name,
        model: this.model,

        outputText:
          response.output_text,

        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }
}
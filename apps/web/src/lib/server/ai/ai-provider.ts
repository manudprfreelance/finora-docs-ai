export type AIProviderName =
  | "openai"
  | "gemini"
  | "anthropic";

export interface AIProviderRequest {
  instructions: string;
  input: string;
}

export interface AIUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AIProviderResponse {
  provider: AIProviderName;
  model: string;
  outputText: string;
  usage: AIUsage;
}

export interface AIProvider {
  readonly name: AIProviderName;
  readonly model: string;

  generate(
    request: AIProviderRequest,
  ): Promise<AIProviderResponse>;
}
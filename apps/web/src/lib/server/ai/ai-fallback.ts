import {
  FinoraError,
  FinoraErrorCode,
  isFinoraError,
} from "@/lib/errors";

import {
  AIProvider,
  AIProviderName,
  AIProviderRequest,
  AIProviderResponse,
} from "@/lib/server/ai/ai-provider";

import {
  executeWithAIRetry,
} from "@/lib/server/ai/ai-retry";

export interface AIFallbackOptions {
  primaryProvider: AIProvider;
  fallbackProvider?: AIProvider;
  maxAttemptsPerProvider?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;

  beforeAttempt?: (
    provider: AIProvider,
    attempt: number,
    maxAttempts: number,
  ) => void | Promise<void>;
}

export interface AIFallbackMetadata {
  used: boolean;
  fromProvider: AIProviderName | null;
  toProvider: AIProviderName | null;
  reason: FinoraErrorCode | null;
}

export interface AIFallbackResult {
  response: AIProviderResponse;
  fallback: AIFallbackMetadata;
}

function canFallbackFromError(
  error: unknown,
): boolean {
  if (!isFinoraError(error)) {
    return false;
  }

  return (
    error.code ===
      "AI_PROVIDER_TIMEOUT" ||
    error.code ===
      "AI_PROVIDER_UNAVAILABLE" ||
    error.code ===
      "AI_PROVIDER_RATE_LIMIT"
  );
}

async function executeProvider(
  provider: AIProvider,
  request: AIProviderRequest,
  options: AIFallbackOptions,
): Promise<AIProviderResponse> {
  return executeWithAIRetry(
    async ({
      attempt,
      maxAttempts,
    }) => {
      await options.beforeAttempt?.(
        provider,
        attempt,
        maxAttempts,
      );

      console.info(
        `[Finora AI] ${provider.name} intento ${attempt}/${maxAttempts}.`,
      );

      return provider.generate(
        request,
      );
    },
    {
      maxAttempts:
        options.maxAttemptsPerProvider,
      initialDelayMs:
        options.initialDelayMs,
      backoffMultiplier:
        options.backoffMultiplier,
    },
  );
}

export async function executeWithAIFallback(
  request: AIProviderRequest,
  options: AIFallbackOptions,
): Promise<AIFallbackResult> {
  const {
    primaryProvider,
    fallbackProvider,
  } = options;

  try {
    const response =
      await executeProvider(
        primaryProvider,
        request,
        options,
      );

    return {
      response,

      fallback: {
        used: false,
        fromProvider: null,
        toProvider: null,
        reason: null,
      },
    };
  } catch (primaryError) {
    if (
      !fallbackProvider ||
      !canFallbackFromError(
        primaryError,
      )
    ) {
      throw primaryError;
    }

    const normalizedPrimaryError =
      primaryError as FinoraError;

    console.warn(
      `[Finora AI] ${primaryProvider.name} no ha podido completar la solicitud ` +
        `después de sus reintentos. Activando fallback a ${fallbackProvider.name}. ` +
        `Código: ${normalizedPrimaryError.code}.`,
    );

    try {
      const response =
        await executeProvider(
          fallbackProvider,
          request,
          options,
        );

      return {
        response,

        fallback: {
          used: true,
          fromProvider:
            primaryProvider.name,
          toProvider:
            fallbackProvider.name,
          reason:
            normalizedPrimaryError.code,
        },
      };
    } catch (fallbackError) {
      console.error(
        `[Finora AI] El proveedor de fallback ${fallbackProvider.name} también ha fallado.`,
      );

      throw fallbackError;
    }
  }
}
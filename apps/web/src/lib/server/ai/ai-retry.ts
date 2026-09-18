import {
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIProviderUnavailableError,
} from "@/lib/errors";

export interface AIRetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
}

export interface AIRetryContext {
  attempt: number;
  maxAttempts: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY_MS = 300;
const DEFAULT_BACKOFF_MULTIPLIER = 2;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function isRetryableAIError(
  error: unknown,
): boolean {
  return (
    error instanceof AIProviderTimeoutError ||
    error instanceof AIProviderRateLimitError ||
    error instanceof AIProviderUnavailableError
  );
}

export async function executeWithAIRetry<T>(
  operation: (
    context: AIRetryContext,
  ) => Promise<T>,
  options: AIRetryOptions = {},
): Promise<T> {
  const maxAttempts =
    options.maxAttempts ??
    DEFAULT_MAX_ATTEMPTS;

  const initialDelayMs =
    options.initialDelayMs ??
    DEFAULT_INITIAL_DELAY_MS;

  const backoffMultiplier =
    options.backoffMultiplier ??
    DEFAULT_BACKOFF_MULTIPLIER;

  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1
  ) {
    throw new Error(
      "maxAttempts debe ser un entero mayor o igual que 1.",
    );
  }

  if (
    !Number.isFinite(initialDelayMs) ||
    initialDelayMs < 0
  ) {
    throw new Error(
      "initialDelayMs debe ser mayor o igual que 0.",
    );
  }

  if (
    !Number.isFinite(backoffMultiplier) ||
    backoffMultiplier < 1
  ) {
    throw new Error(
      "backoffMultiplier debe ser mayor o igual que 1.",
    );
  }

  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    try {
      return await operation({
        attempt,
        maxAttempts,
      });
    } catch (error) {
      lastError = error;

      const retryable =
        isRetryableAIError(error);

      const hasAttemptsRemaining =
        attempt < maxAttempts;

      if (
        !retryable ||
        !hasAttemptsRemaining
      ) {
        throw error;
      }

      const delayMs =
        initialDelayMs *
        Math.pow(
          backoffMultiplier,
          attempt - 1,
        );

      console.warn(
        `[Finora AI] Intento ${attempt}/${maxAttempts} fallido. ` +
          `Reintentando en ${delayMs} ms.`,
      );

      await sleep(delayMs);
    }
  }

  /*
   * Este punto no debería alcanzarse,
   * pero mantenemos una protección
   * defensiva para evitar estados
   * imposibles.
   */
  throw lastError instanceof Error
    ? lastError
    : new Error(
        "La operación de IA ha fallado después de agotar los reintentos.",
      );
}
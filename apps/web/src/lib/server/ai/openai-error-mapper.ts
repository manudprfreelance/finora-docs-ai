import {
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIProviderUnavailableError,
  FinoraError,
} from "@/lib/errors";

type OpenAIErrorLike = {
  name?: unknown;
  message?: unknown;
  status?: unknown;
  code?: unknown;
  cause?: unknown;
};

function asOpenAIErrorLike(
  error: unknown,
): OpenAIErrorLike {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    return error as OpenAIErrorLike;
  }

  return {};
}

function getErrorName(
  error: OpenAIErrorLike,
): string {
  return typeof error.name === "string"
    ? error.name
    : "";
}

function getErrorMessage(
  error: OpenAIErrorLike,
): string {
  return typeof error.message === "string"
    ? error.message
    : "";
}

function getErrorStatus(
  error: OpenAIErrorLike,
): number | null {
  return typeof error.status === "number"
    ? error.status
    : null;
}

function getErrorCode(
  error: OpenAIErrorLike,
): string {
  return typeof error.code === "string"
    ? error.code
    : "";
}

function isTimeoutError(
  error: OpenAIErrorLike,
): boolean {
  const name =
    getErrorName(error).toLowerCase();

  const message =
    getErrorMessage(error).toLowerCase();

  const code =
    getErrorCode(error).toLowerCase();

  return (
    name.includes("timeout") ||
    name.includes("abort") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    code === "etimedout"
  );
}

function isConnectionError(
  error: OpenAIErrorLike,
): boolean {
  const name =
    getErrorName(error).toLowerCase();

  const message =
    getErrorMessage(error).toLowerCase();

  const code =
    getErrorCode(error).toLowerCase();

  return (
    name.includes("connection") ||
    message.includes("connection") ||
    code === "econnreset" ||
    code === "econnrefused" ||
    code === "enotfound" ||
    code === "eai_again"
  );
}

export function mapOpenAIError(
  error: unknown,
): FinoraError {
  if (error instanceof FinoraError) {
    return error;
  }

  const openAIError =
    asOpenAIErrorLike(error);

  const status =
    getErrorStatus(openAIError);

  if (status === 429) {
    return new AIProviderRateLimitError(
      "OpenAI ha alcanzado temporalmente su límite de uso.",
      {
        cause: error,
        details: {
          provider: "openai",
          status,
        },
      },
    );
  }

  if (isTimeoutError(openAIError)) {
    return new AIProviderTimeoutError(
      "OpenAI ha excedido el tiempo máximo de respuesta.",
      {
        cause: error,
        details: {
          provider: "openai",
          status,
        },
      },
    );
  }

  if (
    isConnectionError(openAIError) ||
    (status !== null && status >= 500)
  ) {
    return new AIProviderUnavailableError(
      "OpenAI no está disponible temporalmente.",
      {
        cause: error,
        details: {
          provider: "openai",
          status,
        },
      },
    );
  }

  return new FinoraError(
    "Se ha producido un error no clasificado al comunicarse con OpenAI.",
    "UNKNOWN_ERROR",
    {
      cause: error,
      retryable: false,
      details: {
        provider: "openai",
        status,
        originalName:
          getErrorName(openAIError) ||
          null,
        originalCode:
          getErrorCode(openAIError) ||
          null,
      },
    },
  );
}
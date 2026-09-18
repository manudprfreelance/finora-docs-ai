export type FinoraErrorCode =
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_PROVIDER_RATE_LIMIT"
  | "AI_INVALID_RESPONSE"
  | "DATABASE_ERROR"
  | "WORKFLOW_ERROR"
  | "PDF_GENERATION_ERROR"
  | "STORAGE_ERROR"
  | "VALIDATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "UNKNOWN_ERROR";

export type FinoraErrorOptions = {
  cause?: unknown;
  retryable?: boolean;
  details?: Record<string, unknown>;
};

export class FinoraError extends Error {
  readonly code: FinoraErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: FinoraErrorCode,
    options: FinoraErrorOptions = {},
  ) {
    super(message, {
      cause: options.cause,
    });

    this.name = new.target.name;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AIProviderTimeoutError extends FinoraError {
  constructor(
    message = "El proveedor de IA ha excedido el tiempo máximo de respuesta.",
    options: Omit<FinoraErrorOptions, "retryable"> = {},
  ) {
    super(message, "AI_PROVIDER_TIMEOUT", {
      ...options,
      retryable: true,
    });
  }
}

export class AIProviderUnavailableError extends FinoraError {
  constructor(
    message = "El proveedor de IA no está disponible.",
    options: Omit<FinoraErrorOptions, "retryable"> = {},
  ) {
    super(message, "AI_PROVIDER_UNAVAILABLE", {
      ...options,
      retryable: true,
    });
  }
}

export class AIProviderRateLimitError extends FinoraError {
  constructor(
    message = "El proveedor de IA ha alcanzado su límite de uso.",
    options: Omit<FinoraErrorOptions, "retryable"> = {},
  ) {
    super(message, "AI_PROVIDER_RATE_LIMIT", {
      ...options,
      retryable: true,
    });
  }
}

export class AIInvalidResponseError extends FinoraError {
  constructor(
    message = "El proveedor de IA ha devuelto una respuesta no válida.",
    options: FinoraErrorOptions = {},
  ) {
    super(message, "AI_INVALID_RESPONSE", {
      ...options,
      retryable: options.retryable ?? false,
    });
  }
}

export class DatabaseError extends FinoraError {
  constructor(
    message = "Se ha producido un error en la base de datos.",
    options: FinoraErrorOptions = {},
  ) {
    super(message, "DATABASE_ERROR", {
      ...options,
      retryable: options.retryable ?? true,
    });
  }
}

export class WorkflowError extends FinoraError {
  constructor(
    message = "Se ha producido un error durante la ejecución del workflow.",
    options: FinoraErrorOptions = {},
  ) {
    super(message, "WORKFLOW_ERROR", {
      ...options,
      retryable: options.retryable ?? true,
    });
  }
}

export class PdfGenerationError extends FinoraError {
  constructor(
    message = "No se ha podido generar el documento PDF.",
    options: FinoraErrorOptions = {},
  ) {
    super(message, "PDF_GENERATION_ERROR", {
      ...options,
      retryable: options.retryable ?? true,
    });
  }
}

export class StorageError extends FinoraError {
  constructor(
    message = "No se ha podido almacenar o recuperar el documento.",
    options: FinoraErrorOptions = {},
  ) {
    super(message, "STORAGE_ERROR", {
      ...options,
      retryable: options.retryable ?? true,
    });
  }
}

export class ValidationError extends FinoraError {
  constructor(
    message = "Los datos proporcionados no son válidos.",
    options: FinoraErrorOptions = {},
  ) {
    super(message, "VALIDATION_ERROR", {
      ...options,
      retryable: false,
    });
  }
}

export class AuthorizationError extends FinoraError {
  constructor(
    message = "No tienes permisos para realizar esta operación.",
    options: FinoraErrorOptions = {},
  ) {
    super(message, "AUTHORIZATION_ERROR", {
      ...options,
      retryable: false,
    });
  }
}

export class NotFoundError extends FinoraError {
  constructor(
    message = "No se ha encontrado el recurso solicitado.",
    options: FinoraErrorOptions = {},
  ) {
    super(message, "NOT_FOUND", {
      ...options,
      retryable: false,
    });
  }
}

export function isFinoraError(error: unknown): error is FinoraError {
  return error instanceof FinoraError;
}

export function normalizeError(error: unknown): FinoraError {
  if (isFinoraError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new FinoraError(error.message, "UNKNOWN_ERROR", {
      cause: error,
      retryable: false,
    });
  }

  return new FinoraError(
    "Se ha producido un error desconocido.",
    "UNKNOWN_ERROR",
    {
      details: {
        rawError: String(error),
      },
    },
  );
}
import {
  ApiError,
} from "@google/genai";

import {
  AIInvalidResponseError,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIProviderUnavailableError,
} from "@/lib/errors";

export function mapGeminiError(
  error: unknown,
): Error {
  /*
   * Si el error ya pertenece a la
   * taxonomía de Finora, no volvemos
   * a transformarlo.
   */
  if (
    error instanceof
      AIInvalidResponseError ||
    error instanceof
      AIProviderRateLimitError ||
    error instanceof
      AIProviderTimeoutError ||
    error instanceof
      AIProviderUnavailableError
  ) {
    return error;
  }

  /*
   * El SDK oficial @google/genai
   * expone ApiError con el código
   * HTTP en la propiedad status.
   */
  if (error instanceof ApiError) {
    const status = error.status;

    if (status === 429) {
      return new AIProviderRateLimitError(
        "Gemini ha alcanzado el límite de solicitudes.",
        {
          cause: error,

          details: {
            provider: "gemini",
            status,
          },
        },
      );
    }

    if (
      status === 408 ||
      status === 504
    ) {
      return new AIProviderTimeoutError(
        "Gemini ha agotado el tiempo de espera.",
        {
          cause: error,

          details: {
            provider: "gemini",
            status,
          },
        },
      );
    }

    if (
      status >= 500 &&
      status <= 599
    ) {
      return new AIProviderUnavailableError(
        "Gemini no está disponible temporalmente.",
        {
          cause: error,

          details: {
            provider: "gemini",
            status,
          },
        },
      );
    }

    return new AIProviderUnavailableError(
      "Gemini ha rechazado la solicitud.",
      {
        cause: error,

        details: {
          provider: "gemini",
          status,
        },
      },
    );
  }

  /*
   * Los fallos de red no siempre
   * disponen de una respuesta HTTP.
   * Los tratamos como indisponibilidad
   * transitoria del proveedor.
   */
  if (error instanceof Error) {
    return new AIProviderUnavailableError(
      "No se ha podido comunicar con Gemini.",
      {
        cause: error,

        details: {
          provider: "gemini",
          reason:
            "network_or_unknown_error",
        },
      },
    );
  }

  return new AIProviderUnavailableError(
    "Gemini ha fallado por una causa desconocida.",
    {
      details: {
        provider: "gemini",
        reason:
          "unknown_error",
      },
    },
  );
}
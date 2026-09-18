import {
  AIInvalidResponseError,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIProviderUnavailableError,
} from "@/lib/errors";

import {
  AIProviderName,
} from "@/lib/server/ai/ai-provider";

export type AIFaultMode =
  | "off"
  | "timeout"
  | "timeout_once"
  | "rate_limit"
  | "unavailable"
  | "invalid_response"
  | "openai_timeout"
  | "openai_rate_limit"
  | "openai_unavailable";

function normalizeFaultMode(
  value: string | undefined,
): AIFaultMode {
  switch (value?.trim().toLowerCase()) {
    case "timeout":
      return "timeout";

    case "timeout_once":
      return "timeout_once";

    case "rate_limit":
      return "rate_limit";

    case "unavailable":
      return "unavailable";

    case "invalid_response":
      return "invalid_response";

    case "openai_timeout":
      return "openai_timeout";

    case "openai_rate_limit":
      return "openai_rate_limit";

    case "openai_unavailable":
      return "openai_unavailable";

    default:
      return "off";
  }
}

export function getAIFaultMode(): AIFaultMode {
  /*
   * La inyección de fallos está deshabilitada
   * de forma forzosa en producción.
   */
  if (process.env.NODE_ENV === "production") {
    return "off";
  }

  return normalizeFaultMode(
    process.env.FINORA_AI_FAULT_MODE,
  );
}

function shouldApplyOpenAIFault(
  provider: AIProviderName,
): boolean {
  return provider === "openai";
}

export function injectAIFaultIfConfigured(
  attempt = 1,
  provider: AIProviderName = "openai",
): void {
  const faultMode = getAIFaultMode();

  switch (faultMode) {
    /*
     * Modos históricos.
     *
     * Se mantienen para no romper las pruebas
     * de resiliencia que ya hemos realizado.
     * Al recibir ahora el proveedor, estos
     * modos pueden utilizarse sobre cualquier
     * proveedor que invoque esta función.
     */
    case "timeout":
      throw new AIProviderTimeoutError(
        "Timeout de IA simulado para una prueba de resiliencia.",
        {
          details: {
            provider,
            simulated: true,
            faultMode,
            attempt,
          },
        },
      );

    case "timeout_once":
      if (attempt === 1) {
        throw new AIProviderTimeoutError(
          "Timeout transitorio de IA simulado en el primer intento.",
          {
            details: {
              provider,
              simulated: true,
              faultMode,
              attempt,
            },
          },
        );
      }

      return;

    case "rate_limit":
      throw new AIProviderRateLimitError(
        "Rate limit de IA simulado para una prueba de resiliencia.",
        {
          details: {
            provider,
            status: 429,
            simulated: true,
            faultMode,
            attempt,
          },
        },
      );

    case "unavailable":
      throw new AIProviderUnavailableError(
        "Indisponibilidad de IA simulada para una prueba de resiliencia.",
        {
          details: {
            provider,
            status: 503,
            simulated: true,
            faultMode,
            attempt,
          },
        },
      );

    case "invalid_response":
      throw new AIInvalidResponseError(
        "Respuesta inválida de IA simulada para una prueba de resiliencia.",
        {
          details: {
            provider,
            simulated: true,
            faultMode,
            attempt,
          },
        },
      );

    /*
     * Modos específicos de OpenAI.
     *
     * Estos son los que utilizaremos para
     * demostrar el fallback multi-proveedor:
     *
     * OpenAI falla -> Gemini permanece sano.
     */
    case "openai_timeout":
      if (!shouldApplyOpenAIFault(provider)) {
        return;
      }

      throw new AIProviderTimeoutError(
        "Timeout de OpenAI simulado para probar el fallback.",
        {
          details: {
            provider,
            simulated: true,
            faultMode,
            attempt,
          },
        },
      );

    case "openai_rate_limit":
      if (!shouldApplyOpenAIFault(provider)) {
        return;
      }

      throw new AIProviderRateLimitError(
        "Rate limit de OpenAI simulado para probar el fallback.",
        {
          details: {
            provider,
            status: 429,
            simulated: true,
            faultMode,
            attempt,
          },
        },
      );

    case "openai_unavailable":
      if (!shouldApplyOpenAIFault(provider)) {
        return;
      }

      throw new AIProviderUnavailableError(
        "Indisponibilidad de OpenAI simulada para probar el fallback.",
        {
          details: {
            provider,
            status: 503,
            simulated: true,
            faultMode,
            attempt,
          },
        },
      );

    case "off":
    default:
      return;
  }
}
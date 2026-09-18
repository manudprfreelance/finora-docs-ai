import {
  FinoraError,
  isFinoraError,
} from "@/lib/errors";

export const AI_ALL_PROVIDERS_UNAVAILABLE =
  "AI_ALL_PROVIDERS_UNAVAILABLE" as const;

export interface AIDegradedModeInfo {
  active: true;
  code:
    typeof AI_ALL_PROVIDERS_UNAVAILABLE;
  reason:
    | "timeout"
    | "rate_limit"
    | "unavailable";
  originalErrorCode:
    FinoraError["code"];
}

function getDegradedReason(
  error: FinoraError,
): AIDegradedModeInfo["reason"] | null {
  switch (error.code) {
    case "AI_PROVIDER_TIMEOUT":
      return "timeout";

    case "AI_PROVIDER_RATE_LIMIT":
      return "rate_limit";

    case "AI_PROVIDER_UNAVAILABLE":
      return "unavailable";

    default:
      return null;
  }
}

export function shouldActivateAIDegradedMode(
  error: unknown,
): error is FinoraError {
  if (!isFinoraError(error)) {
    return false;
  }

  return (
    error.code ===
      "AI_PROVIDER_TIMEOUT" ||
    error.code ===
      "AI_PROVIDER_RATE_LIMIT" ||
    error.code ===
      "AI_PROVIDER_UNAVAILABLE"
  );
}

export function buildAIDegradedModeInfo(
  error: FinoraError,
): AIDegradedModeInfo {
  const reason =
    getDegradedReason(error);

  if (!reason) {
    throw new Error(
      `El error ${error.code} no permite activar el modo degradado de IA.`,
    );
  }

  return {
    active: true,
    code:
      AI_ALL_PROVIDERS_UNAVAILABLE,
    reason,
    originalErrorCode:
      error.code,
  };
}
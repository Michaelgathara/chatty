export class PiBackendError extends Error {
  constructor(
    message: string,
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, options);
    this.name = "PiBackendError";
  }
}

export function createPiBackendError(
  phase: "load" | "ensure-session" | "prompt",
  cause: unknown,
): PiBackendError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  const prefix =
    phase === "load"
      ? "Failed to load the Pi SDK."
      : phase === "ensure-session"
        ? "Failed to create or reopen a Pi session."
        : "Failed to send a message through Pi.";

  const hint = inferHint(detail);
  return new PiBackendError(`${prefix} ${hint}`, { cause });
}

function inferHint(detail: string): string {
  const normalized = detail.toLowerCase();

  if (normalized.includes("no model selected")) {
    return "Pi does not have a model selected. Configure a default model in Pi or extend chatty to pass one explicitly.";
  }

  if (
    normalized.includes("no api key") ||
    normalized.includes("no api-key") ||
    normalized.includes("credential") ||
    normalized.includes("auth")
  ) {
    return "Pi could not authenticate with a provider. Set the required provider API key environment variable before using the Pi backend.";
  }

  if (normalized.includes("module") && normalized.includes("not found")) {
    return "The Pi SDK is not available at runtime. Make sure @earendil-works/pi-coding-agent is installed correctly.";
  }

  return `Underlying error: ${detail}`;
}

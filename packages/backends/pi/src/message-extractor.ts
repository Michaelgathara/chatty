export interface PiReplyExtractionInput {
  streamedText: string;
  agentEndMessages?: unknown[];
  sessionMessages?: unknown[];
}

export function extractPiReply(input: PiReplyExtractionInput): string {
  const streamed = normalize(input.streamedText);
  if (streamed) {
    return streamed;
  }

  const fromAgentEnd = extractLatestAssistantText(input.agentEndMessages);
  if (fromAgentEnd) {
    return fromAgentEnd;
  }

  return extractLatestAssistantText(input.sessionMessages);
}

function extractLatestAssistantText(messages: unknown[] | undefined): string {
  if (!Array.isArray(messages)) {
    return "";
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = extractAssistantText(messages[index]);
    if (text) {
      return text;
    }
  }

  return "";
}

function extractAssistantText(message: unknown): string {
  if (!isAssistantLike(message)) {
    return "";
  }

  return normalize(extractTextPayload(message));
}

function isAssistantLike(message: unknown): boolean {
  if (!isRecord(message)) {
    return false;
  }

  if (message.role === "assistant" || message.type === "assistant") {
    return true;
  }

  if ("message" in message) {
    return isAssistantLike(message.message);
  }

  return false;
}

function extractTextPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractTextPayload).filter(Boolean).join("\n");
  }

  if (!isRecord(value)) {
    return "";
  }

  if ("message" in value) {
    const nested = extractTextPayload(value.message);
    if (nested) {
      return nested;
    }
  }

  if ("content" in value) {
    const nested = extractTextPayload(value.content);
    if (nested) {
      return nested;
    }
  }

  if ("parts" in value) {
    const nested = extractTextPayload(value.parts);
    if (nested) {
      return nested;
    }
  }

  if (value.type === "text" && typeof value.text === "string") {
    return value.text;
  }

  if (typeof value.text === "string") {
    return value.text;
  }

  return "";
}

function normalize(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

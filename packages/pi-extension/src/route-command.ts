export const CHATTY_ROUTE_COMMAND = "chatty-route";

export interface ChattyRouteCommandPayload {
  projectId: string;
  message: string;
}

export function buildRouteCommand(payload: ChattyRouteCommandPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `/${CHATTY_ROUTE_COMMAND} ${encoded}`;
}

export function parseRouteCommandArgs(
  rawArgs: string,
): ChattyRouteCommandPayload | { error: string } {
  const encoded = rawArgs.trim();
  if (!encoded) {
    return { error: "Missing route payload." };
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<ChattyRouteCommandPayload>;
    if (typeof parsed.projectId !== "string" || typeof parsed.message !== "string") {
      return { error: "Invalid route payload." };
    }

    return {
      projectId: parsed.projectId,
      message: parsed.message,
    };
  } catch {
    return { error: "Route payload could not be decoded." };
  }
}

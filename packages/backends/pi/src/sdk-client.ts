import path from "node:path";

import { BackendSessionBinding } from "../../../core/src";
import { PiEnsureSessionInput, PiPromptInput, PiPromptResult, PiSessionClient } from "./client";
import { PiBackendConfig, createDefaultPiBackendConfig } from "./config";
import { createPiBackendError } from "./errors";
import { extractPiReply } from "./message-extractor";

interface PiAgentSession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
  readonly messages: unknown[];
  prompt(text: string): Promise<void>;
  subscribe(listener: (event: unknown) => void): () => void;
  dispose(): void;
}

interface PiSdkModule {
  SessionManager: {
    open(sessionFile: string): unknown;
    create(cwd: string, sessionDir?: string): unknown;
  };
  createAgentSession(options?: {
    cwd?: string;
    agentDir?: string;
    sessionManager?: unknown;
  }): Promise<{
    session: PiAgentSession;
  }>;
}

let piSdkPromise: Promise<PiSdkModule> | undefined;

export class PiSdkSessionClient implements PiSessionClient {
  constructor(
    private readonly workspaceRoot: string,
    private readonly config: PiBackendConfig = createDefaultPiBackendConfig(workspaceRoot),
  ) {}

  async ensureSession(input: PiEnsureSessionInput): Promise<BackendSessionBinding> {
    try {
      const session = await this.openSession(input);

      try {
        return readBinding(session);
      } finally {
        session.dispose();
      }
    } catch (error) {
      throw createPiBackendError("ensure-session", error);
    }
  }

  async prompt(input: PiPromptInput): Promise<PiPromptResult> {
    try {
      const session = await this.openSession(input);
      let reply = "";
      let agentEndMessages: unknown[] | undefined;
      const unsubscribe = session.subscribe((event) => {
        const delta = readAssistantDelta(event);
        if (delta) {
          reply += delta;
        }

        const maybeAgentEndMessages = readAgentEndMessages(event);
        if (maybeAgentEndMessages) {
          agentEndMessages = maybeAgentEndMessages;
        }
      });

      try {
        await session.prompt(input.message);
        return {
          reply: extractPiReply({
            streamedText: reply,
            agentEndMessages,
            sessionMessages: session.messages,
          }),
          backendSession: readBinding(session),
        };
      } finally {
        unsubscribe();
        session.dispose();
      }
    } catch (error) {
      throw createPiBackendError("prompt", error);
    }
  }

  private async openSession(input: {
    projectId: string;
    projectRoot: string;
    hiddenSessionId: string;
    backendSession?: { sessionFile?: string };
  }): Promise<PiAgentSession> {
    const pi = await loadPiSdk();
    const sessionManager = input.backendSession?.sessionFile
      ? pi.SessionManager.open(input.backendSession.sessionFile)
      : pi.SessionManager.create(
          input.projectRoot,
          path.join(this.config.sessionRootDirectory, input.projectId, input.hiddenSessionId),
        );

    const options = {
      cwd: input.projectRoot,
      agentDir: this.config.agentDirectory,
      sessionManager,
    };

    const { session } = await pi.createAgentSession(options);
    return session;
  }
}

async function loadPiSdk(): Promise<PiSdkModule> {
  try {
    piSdkPromise ??= import("@earendil-works/pi-coding-agent");
    return await piSdkPromise;
  } catch (error) {
    throw createPiBackendError("load", error);
  }
}

function readBinding(session: PiAgentSession): BackendSessionBinding {
  return {
    sessionId: session.sessionId,
    sessionFile: session.sessionFile,
  };
}

function readAssistantDelta(event: unknown): string {
  const maybeUpdate = event as {
    type?: string;
    assistantMessageEvent?: {
      type?: string;
      delta?: string;
    };
  };

  if (maybeUpdate.type !== "message_update") {
    return "";
  }

  if (maybeUpdate.assistantMessageEvent?.type !== "text_delta") {
    return "";
  }

  return maybeUpdate.assistantMessageEvent.delta ?? "";
}

function readAgentEndMessages(event: unknown): unknown[] | undefined {
  const maybeEnd = event as {
    type?: string;
    messages?: unknown[];
  };

  if (maybeEnd.type !== "agent_end") {
    return undefined;
  }

  return Array.isArray(maybeEnd.messages) ? maybeEnd.messages : undefined;
}

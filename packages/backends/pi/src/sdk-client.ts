import path from "node:path";

import { BackendSessionBinding } from "../../../core/src";
import { PiEnsureSessionInput, PiPromptInput, PiPromptResult, PiSessionClient } from "./client";

interface PiAgentSession {
  readonly sessionId: string;
  readonly sessionFile: string | undefined;
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
    sessionManager?: unknown;
  }): Promise<{
    session: PiAgentSession;
  }>;
}

let piSdkPromise: Promise<PiSdkModule> | undefined;

export class PiSdkSessionClient implements PiSessionClient {
  constructor(private readonly workspaceRoot: string) {}

  async ensureSession(input: PiEnsureSessionInput): Promise<BackendSessionBinding> {
    const session = await this.openSession(input);

    try {
      return readBinding(session);
    } finally {
      session.dispose();
    }
  }

  async prompt(input: PiPromptInput): Promise<PiPromptResult> {
    const session = await this.openSession(input);
    let reply = "";
    const unsubscribe = session.subscribe((event) => {
      const delta = readAssistantDelta(event);
      if (delta) {
        reply += delta;
      }
    });

    try {
      await session.prompt(input.message);
      return {
        reply: reply.trim(),
        backendSession: readBinding(session),
      };
    } finally {
      unsubscribe();
      session.dispose();
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
          path.join(this.workspaceRoot, ".chatty", "backends", "pi", "projects", input.projectId),
        );

    const options = {
      cwd: input.projectRoot,
      sessionManager,
    };

    const { session } = await pi.createAgentSession(options);
    return session;
  }
}

async function loadPiSdk(): Promise<PiSdkModule> {
  piSdkPromise ??= import("@earendil-works/pi-coding-agent");
  return piSdkPromise;
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

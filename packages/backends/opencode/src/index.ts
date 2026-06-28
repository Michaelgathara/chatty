import {
  BackendAdapter,
  BackendEnsureSessionInput,
  BackendEnsureSessionResult,
  BackendSendMessageInput,
  BackendSendMessageResult,
} from "../../../core/src";

export class OpenCodeBackendAdapter implements BackendAdapter {
  readonly kind = "opencode" as const;

  describe(): string {
    return "Planned OpenCode adapter for evaluating hidden-session routing against OpenCode's session model.";
  }

  async ensureSession(input: BackendEnsureSessionInput): Promise<BackendEnsureSessionResult> {
    return {
      binding: {
        sessionId: input.session.backendSession?.sessionId ?? `opencode:placeholder:${input.session.id}`,
      },
      state: input.session.backendSession ? "existing" : "created",
    };
  }

  async sendMessage(input: BackendSendMessageInput): Promise<BackendSendMessageResult> {
    return {
      reply: [
        `[opencode:${input.project.id}] Adapter scaffold is present but not wired yet.`,
        `Backend session placeholder: ${input.backendSession.sessionId}`,
        "Use this path to compare OpenCode's built-in sessions, compaction, and plugin hooks against Pi.",
      ].join("\n"),
      summary: `OpenCode adapter placeholder for ${input.project.id}.`,
    };
  }
}

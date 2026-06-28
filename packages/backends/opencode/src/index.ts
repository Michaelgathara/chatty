import { BackendAdapter, BackendResponse, BackendSendInput } from "../../../core/src";

export class OpenCodeBackendAdapter implements BackendAdapter {
  readonly kind = "opencode" as const;

  describe(): string {
    return "Planned OpenCode adapter for evaluating hidden-session routing against OpenCode's session model.";
  }

  async send(input: BackendSendInput): Promise<BackendResponse> {
    return {
      sessionId: input.session.id,
      reply: [
        `[opencode:${input.project.id}] Adapter scaffold is present but not wired yet.`,
        "Use this path to compare OpenCode's built-in sessions, compaction, and plugin hooks against Pi.",
      ].join("\n"),
      summary: `OpenCode adapter placeholder for ${input.project.id}.`,
    };
  }
}

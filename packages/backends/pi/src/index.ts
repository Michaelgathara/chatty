import { BackendAdapter, BackendResponse, BackendSendInput } from "../../../core/src";

export class PiBackendAdapter implements BackendAdapter {
  readonly kind = "pi" as const;

  describe(): string {
    return "Planned Pi adapter. Intended to own create/resume/send through Pi's extension or SDK surface.";
  }

  async send(input: BackendSendInput): Promise<BackendResponse> {
    return {
      sessionId: input.session.id,
      reply: [
        `[pi:${input.project.id}] Adapter scaffold is present but not wired yet.`,
        "The control plane can already decide when to create or resume a hidden session.",
        "Next step: connect this adapter to Pi session APIs and map external session ids into the registry.",
      ].join("\n"),
      summary: `Pi adapter placeholder for ${input.project.id}.`,
    };
  }
}

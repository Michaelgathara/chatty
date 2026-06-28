import { BackendAdapter, BackendResponse, BackendSendInput } from "../../../core/src";

export class MockBackendAdapter implements BackendAdapter {
  readonly kind = "mock" as const;

  describe(): string {
    return "Local stub backend for proving routing, session isolation, and persistence.";
  }

  async send(input: BackendSendInput): Promise<BackendResponse> {
    const priorUserTurns = input.history.filter((message) => message.role === "user");
    const rememberedTopic = priorUserTurns.at(-1)?.content;
    const evidence = input.routeDecision.evidence
      .slice(0, 2)
      .map((item) => item.value)
      .join(" ");

    const replyLines = [
      `[mock:${input.project.id}] Session ${input.session.id.slice(0, 8)} is active.`,
      `Routed because: ${evidence || "no routing evidence was captured."}`,
      rememberedTopic
        ? `This hidden thread already remembered: "${trim(rememberedTopic, 80)}".`
        : "This is the first user turn in the hidden session.",
      `Latest message: "${trim(input.message, 120)}"`,
      "Swap this adapter with Pi or OpenCode once the router control plane is proven.",
    ];

    const summary = rememberedTopic
      ? `Continuing ${input.project.id}. Latest topic: ${trim(input.message, 80)}`
      : `Started ${input.project.id}. Latest topic: ${trim(input.message, 80)}`;

    return {
      sessionId: input.session.id,
      reply: replyLines.join("\n"),
      summary,
    };
  }
}

function trim(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

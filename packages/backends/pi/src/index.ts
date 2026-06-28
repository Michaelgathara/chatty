import {
  BackendAdapter,
  BackendEnsureSessionInput,
  BackendEnsureSessionResult,
  BackendSendMessageInput,
  BackendSendMessageResult,
} from "../../../core/src";
import { PiSessionClient } from "./client";
import { PiBackendConfig } from "./config";
import { PiSdkSessionClient } from "./sdk-client";

export class PiBackendAdapter implements BackendAdapter {
  readonly kind = "pi" as const;

  constructor(private readonly client: PiSessionClient) {}

  describe(): string {
    return "Pi SDK-backed adapter with explicit session lifecycle and persisted provider session bindings.";
  }

  async ensureSession(input: BackendEnsureSessionInput): Promise<BackendEnsureSessionResult> {
    const binding = await this.client.ensureSession({
      projectId: input.project.id,
      projectRoot: input.project.rootPath,
      hiddenSessionId: input.session.id,
      backendSession: input.session.backendSession,
    });

    return {
      binding,
      state: input.session.backendSession ? "existing" : "created",
    };
  }

  async sendMessage(input: BackendSendMessageInput): Promise<BackendSendMessageResult> {
    const result = await this.client.prompt({
      projectId: input.project.id,
      projectRoot: input.project.rootPath,
      hiddenSessionId: input.session.id,
      backendSession: input.backendSession,
      message: input.message,
    });

    return {
      reply: result.reply,
      summary: summarizePiReply(input.project.id, input.message, result.reply),
      backendSession: result.backendSession,
    };
  }
}

export function createPiBackendAdapter(
  workspaceRoot: string,
  config?: PiBackendConfig,
): PiBackendAdapter {
  return new PiBackendAdapter(new PiSdkSessionClient(workspaceRoot, config));
}

function summarizePiReply(projectId: string, prompt: string, reply: string): string {
  const basis = reply.trim() || prompt;
  return `${projectId}: ${trim(basis, 80)}`;
}

function trim(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

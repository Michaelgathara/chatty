import { BackendSessionBinding, BackendSessionRef } from "../../../core/src";

export interface PiEnsureSessionInput {
  projectId: string;
  projectRoot: string;
  hiddenSessionId: string;
  backendSession?: BackendSessionRef;
}

export interface PiPromptInput {
  projectId: string;
  projectRoot: string;
  hiddenSessionId: string;
  backendSession: BackendSessionRef;
  message: string;
}

export interface PiPromptResult {
  reply: string;
  backendSession?: BackendSessionBinding;
}

export interface PiSessionClient {
  ensureSession(input: PiEnsureSessionInput): Promise<BackendSessionBinding>;
  prompt(input: PiPromptInput): Promise<PiPromptResult>;
}

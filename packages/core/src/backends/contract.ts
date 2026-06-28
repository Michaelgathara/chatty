import {
  BackendKind,
  BackendSessionBinding,
  BackendSessionRef,
  ChatMessage,
  HiddenSessionRecord,
  ProjectDefinition,
  RouteDecision,
} from "../types";

export type BackendSessionState = "created" | "resumed" | "existing";

export interface BackendEnsureSessionInput {
  project: ProjectDefinition;
  session: HiddenSessionRecord;
  history: ChatMessage[];
}

export interface BackendEnsureSessionResult {
  binding: BackendSessionBinding;
  state: BackendSessionState;
}

export interface BackendSendMessageInput {
  project: ProjectDefinition;
  session: HiddenSessionRecord;
  backendSession: BackendSessionRef;
  history: ChatMessage[];
  message: string;
  routeDecision: RouteDecision;
}

export interface BackendSendMessageResult {
  reply: string;
  summary: string;
  backendSession?: BackendSessionBinding;
}

export interface BackendAdapter {
  kind: BackendKind;
  describe(): string;
  ensureSession(input: BackendEnsureSessionInput): Promise<BackendEnsureSessionResult>;
  sendMessage(input: BackendSendMessageInput): Promise<BackendSendMessageResult>;
}

export type ChatRole = "system" | "user" | "assistant";

export type BackendKind = "mock" | "pi" | "opencode";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface BackendSessionBinding {
  sessionId: string;
  sessionFile?: string;
}

export interface BackendSessionRef {
  sessionId: string;
  sessionFile?: string;
  boundAt: string;
  lastUsedAt: string;
}

export interface ProjectDefinition {
  id: string;
  name: string;
  rootPath: string;
  aliases: string[];
  hints: string[];
  defaultBackend: BackendKind;
}

export interface HiddenSessionRecord {
  id: string;
  projectId: string;
  backend: BackendKind;
  backendSession?: BackendSessionRef;
  title: string;
  summary: string;
  createdAt: string;
  lastUsedAt: string;
  messageCount: number;
}

export type EvidenceKind =
  | "override"
  | "project-id"
  | "alias"
  | "path"
  | "hint"
  | "recency"
  | "single-project"
  | "fallback";

export interface RoutingEvidence {
  kind: EvidenceKind;
  value: string;
  weight: number;
}

export interface ProjectScore {
  projectId: string;
  score: number;
  evidence: RoutingEvidence[];
}

export interface RouteDecision {
  projectId?: string;
  action: "resume" | "create" | "clarify";
  confidence: number;
  evidence: RoutingEvidence[];
  candidates: ProjectScore[];
  session?: HiddenSessionRecord;
}

export interface RouterInput {
  message: string;
  overrideProjectId?: string;
  lastActiveProjectId?: string;
}

export interface ResolvedRoute {
  project: ProjectDefinition;
  session: HiddenSessionRecord;
  history: ChatMessage[];
  decision: RouteDecision;
}

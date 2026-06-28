import { ChatMessage, HiddenSessionRecord, ProjectDefinition } from "../types";

export interface ProjectStore {
  readAll(): Promise<ProjectDefinition[]>;
  writeAll(projects: readonly ProjectDefinition[]): Promise<void>;
}

export interface SessionStore {
  readAll(): Promise<HiddenSessionRecord[]>;
  writeAll(sessions: readonly HiddenSessionRecord[]): Promise<void>;
}

export interface MessageStore {
  getBySessionId(sessionId: string): Promise<ChatMessage[]>;
  append(sessionId: string, messages: readonly ChatMessage[]): Promise<void>;
}

export interface ChattyStores {
  projectStore: ProjectStore;
  sessionStore: SessionStore;
  messageStore: MessageStore;
}

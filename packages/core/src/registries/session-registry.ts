import { randomUUID } from "node:crypto";

import { MessageStore, SessionStore } from "../storage";
import { BackendKind, BackendSessionBinding, ChatMessage, HiddenSessionRecord } from "../types";

export class SessionRegistry {
  constructor(
    private readonly sessions: SessionStore,
    private readonly messages: MessageStore,
  ) {}

  async listSessions(): Promise<HiddenSessionRecord[]> {
    const store = await this.sessions.readAll();
    return [...store].sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
  }

  async findByBackendSessionFile(
    sessionFile: string,
    backend?: BackendKind,
  ): Promise<HiddenSessionRecord | undefined> {
    const store = await this.sessions.readAll();
    return store.find((session) => {
      if (backend && session.backend !== backend) {
        return false;
      }

      return session.backendSession?.sessionFile === sessionFile;
    });
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.messages.getBySessionId(sessionId);
  }

  async ensureSession(projectId: string, backend: BackendKind): Promise<{ session: HiddenSessionRecord; created: boolean }> {
    const store = await this.sessions.readAll();
    const existing = store.find(
      (session) => session.projectId === projectId && session.backend === backend,
    );

    if (existing) {
      existing.lastUsedAt = new Date().toISOString();
      await this.sessions.writeAll(store);
      return { session: existing, created: false };
    }

    const now = new Date().toISOString();
    const session: HiddenSessionRecord = {
      id: randomUUID(),
      projectId,
      backend,
      backendSession: undefined,
      title: `${projectId} hidden session`,
      summary: "Fresh hidden session.",
      createdAt: now,
      lastUsedAt: now,
      messageCount: 0,
    };

    store.push(session);
    await this.sessions.writeAll(store);
    return { session, created: true };
  }

  async bindBackendSession(
    sessionId: string,
    binding: BackendSessionBinding,
  ): Promise<HiddenSessionRecord> {
    const store = await this.sessions.readAll();
    const session = store.find((entry) => entry.id === sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} does not exist.`);
    }

    session.backendSession = mergeBackendSession(
      session.backendSession,
      binding,
      new Date().toISOString(),
    );
    await this.sessions.writeAll(store);
    return session;
  }

  async recordExchange(input: {
    sessionId: string;
    messages: ChatMessage[];
    summary: string;
    backendSession?: BackendSessionBinding;
  }): Promise<void> {
    const store = await this.sessions.readAll();
    const session = store.find((entry) => entry.id === input.sessionId);

    if (!session) {
      throw new Error(`Session ${input.sessionId} does not exist.`);
    }

    const now = new Date().toISOString();
    await this.messages.append(input.sessionId, input.messages);
    session.summary = input.summary;
    session.lastUsedAt = now;
    session.messageCount += input.messages.length;
    session.backendSession = mergeBackendSession(session.backendSession, input.backendSession, now);
    await this.sessions.writeAll(store);
  }
}

function mergeBackendSession(
  current: HiddenSessionRecord["backendSession"],
  next: BackendSessionBinding | undefined,
  now: string,
): HiddenSessionRecord["backendSession"] {
  if (!next) {
    return current;
  }

  if (current?.sessionId === next.sessionId) {
    return {
      ...current,
      lastUsedAt: now,
    };
  }

  return {
    sessionId: next.sessionId,
    sessionFile: next.sessionFile,
    boundAt: now,
    lastUsedAt: now,
  };
}

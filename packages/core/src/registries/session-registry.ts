import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { BackendKind, ChatMessage, HiddenSessionRecord, SessionStoreShape } from "../types";

export class SessionRegistry {
  private readonly stateDir: string;
  private readonly sessionsFile: string;

  constructor(private readonly workspaceRoot: string) {
    this.stateDir = path.join(workspaceRoot, ".chatty");
    this.sessionsFile = path.join(this.stateDir, "sessions.json");
  }

  async listSessions(): Promise<HiddenSessionRecord[]> {
    const store = await this.readStore();
    return [...store.sessions].sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const store = await this.readStore();
    return store.messages[sessionId] ?? [];
  }

  async ensureSession(projectId: string, backend: BackendKind): Promise<{ session: HiddenSessionRecord; created: boolean }> {
    const store = await this.readStore();
    const existing = store.sessions.find(
      (session) => session.projectId === projectId && session.backend === backend,
    );

    if (existing) {
      existing.lastUsedAt = new Date().toISOString();
      await this.writeStore(store);
      return { session: existing, created: false };
    }

    const now = new Date().toISOString();
    const session: HiddenSessionRecord = {
      id: randomUUID(),
      projectId,
      backend,
      title: `${projectId} hidden session`,
      summary: "Fresh hidden session.",
      createdAt: now,
      lastUsedAt: now,
      messageCount: 0,
    };

    store.sessions.push(session);
    store.messages[session.id] = [];
    await this.writeStore(store);
    return { session, created: true };
  }

  async appendMessages(sessionId: string, messages: ChatMessage[], summary: string): Promise<void> {
    const store = await this.readStore();
    const session = store.sessions.find((entry) => entry.id === sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} does not exist.`);
    }

    const existingMessages = store.messages[sessionId] ?? [];
    store.messages[sessionId] = [...existingMessages, ...messages];
    session.summary = summary;
    session.lastUsedAt = new Date().toISOString();
    session.messageCount = store.messages[sessionId].length;
    await this.writeStore(store);
  }

  private async readStore(): Promise<SessionStoreShape> {
    await fs.mkdir(this.stateDir, { recursive: true });

    try {
      const raw = await fs.readFile(this.sessionsFile, "utf8");
      const parsed = JSON.parse(raw) as SessionStoreShape;
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        messages: parsed.messages ?? {},
      };
    } catch (error) {
      if (isMissingFile(error)) {
        const emptyStore = createEmptyStore();
        await this.writeStore(emptyStore);
        return emptyStore;
      }

      throw error;
    }
  }

  private async writeStore(store: SessionStoreShape): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.sessionsFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function createEmptyStore(): SessionStoreShape {
  return { sessions: [], messages: {} };
}

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { SessionRegistry } from "../src/registries/session-registry";
import { JsonMessageStore, JsonSessionStore } from "../src/storage";

test("SessionRegistry persists sessions and message history", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "chatty-sessions-"));
  const stateDirectory = path.join(workspace, ".chatty");

  try {
    const sessions = new SessionRegistry(
      new JsonSessionStore(stateDirectory),
      new JsonMessageStore(stateDirectory),
    );
    const created = await sessions.ensureSession("chatty", "mock");

    assert.equal(created.created, true);
    await sessions.bindBackendSession(created.session.id, {
      sessionId: "mock:chatty-1",
      sessionFile: "D:\\Projects\\chatty\\.chatty\\backends\\mock\\session-1.jsonl",
    });

    await sessions.recordExchange({
      sessionId: created.session.id,
      messages: [
        { role: "user", content: "hello", createdAt: "2026-01-01T00:00:00.000Z" },
        { role: "assistant", content: "world", createdAt: "2026-01-01T00:00:01.000Z" },
      ],
      summary: "A short summary",
    });

    const reloaded = new SessionRegistry(
      new JsonSessionStore(stateDirectory),
      new JsonMessageStore(stateDirectory),
    );
    const resumed = await reloaded.ensureSession("chatty", "mock");
    const history = await reloaded.getMessages(created.session.id);
    const session = (await reloaded.listSessions())[0];

    assert.equal(resumed.created, false);
    assert.equal(resumed.session.id, created.session.id);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.content, "hello");
    assert.equal(session?.messageCount, 2);
    assert.equal(session?.backendSession?.sessionId, "mock:chatty-1");
    assert.equal(session?.backendSession?.sessionFile, "D:\\Projects\\chatty\\.chatty\\backends\\mock\\session-1.jsonl");
    assert.ok(session?.backendSession?.boundAt);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("SessionRegistry updates the backend binding when a provider session changes", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "chatty-session-rebind-"));
  const stateDirectory = path.join(workspace, ".chatty");

  try {
    const sessions = new SessionRegistry(
      new JsonSessionStore(stateDirectory),
      new JsonMessageStore(stateDirectory),
    );
    const created = await sessions.ensureSession("chatty", "mock");
    await sessions.bindBackendSession(created.session.id, {
      sessionId: "mock:chatty-1",
      sessionFile: "D:\\Projects\\chatty\\.chatty\\backends\\mock\\session-1.jsonl",
    });

    await sessions.recordExchange({
      sessionId: created.session.id,
      messages: [
        { role: "user", content: "rebind", createdAt: "2026-01-01T00:00:02.000Z" },
      ],
      summary: "Rebound backend session",
      backendSession: {
        sessionId: "mock:chatty-2",
        sessionFile: "D:\\Projects\\chatty\\.chatty\\backends\\mock\\session-2.jsonl",
      },
    });

    const rebound = (await sessions.listSessions())[0];
    assert.equal(rebound?.backendSession?.sessionId, "mock:chatty-2");
    assert.equal(rebound?.backendSession?.sessionFile, "D:\\Projects\\chatty\\.chatty\\backends\\mock\\session-2.jsonl");
    assert.equal(rebound?.messageCount, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

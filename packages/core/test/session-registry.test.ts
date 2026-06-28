import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { SessionRegistry } from "../src/registries/session-registry";

test("SessionRegistry persists sessions and message history", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "chatty-sessions-"));

  try {
    const sessions = new SessionRegistry(workspace);
    const created = await sessions.ensureSession("chatty", "mock");

    assert.equal(created.created, true);

    await sessions.appendMessages(
      created.session.id,
      [
        { role: "user", content: "hello", createdAt: "2026-01-01T00:00:00.000Z" },
        { role: "assistant", content: "world", createdAt: "2026-01-01T00:00:01.000Z" },
      ],
      "A short summary",
    );

    const reloaded = new SessionRegistry(workspace);
    const resumed = await reloaded.ensureSession("chatty", "mock");
    const history = await reloaded.getMessages(created.session.id);

    assert.equal(resumed.created, false);
    assert.equal(resumed.session.id, created.session.id);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.content, "hello");
    assert.equal((await reloaded.listSessions())[0]?.messageCount, 2);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRegistry } from "../src/registries/project-registry";
import { MessageRouter } from "../src/routing/message-router";
import { SessionRegistry } from "../src/registries/session-registry";
import { JsonMessageStore, JsonProjectStore, JsonSessionStore } from "../src/storage";

test("MessageRouter creates then resumes a single project's hidden session", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "chatty-router-"));
  const stateDirectory = path.join(workspace, ".chatty");

  try {
    const projects = new ProjectRegistry(new JsonProjectStore(stateDirectory));
    const sessions = new SessionRegistry(
      new JsonSessionStore(stateDirectory),
      new JsonMessageStore(stateDirectory),
    );
    const router = new MessageRouter(projects, sessions);

    await projects.register({
      id: "Chatty App",
      name: "Chatty App",
      rootPath: workspace,
      aliases: ["chatty"],
      hints: ["router"],
      defaultBackend: "mock",
    });

    const first = await router.resolve({ message: "Help me think about the architecture" });
    assert.ok("project" in first);
    assert.equal(first.project.id, "chatty-app");
    assert.equal(first.decision.action, "create");

    const second = await router.resolve({ message: "Continue the same thread please" });
    assert.ok("project" in second);
    assert.equal(second.project.id, "chatty-app");
    assert.equal(second.decision.action, "resume");
    assert.equal(second.session.id, first.session.id);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

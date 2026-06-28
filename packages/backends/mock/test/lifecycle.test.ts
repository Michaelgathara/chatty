import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  createJsonStores,
  MessageRouter,
  ProjectRegistry,
  SessionRegistry,
} from "../../../core/src";
import { MockBackendAdapter } from "../src/index";

test("Mock backend lifecycle reuses the same backend session across restart", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "chatty-mock-backend-"));
  const backend = new MockBackendAdapter();

  try {
    const firstStores = createJsonStores(workspace);
    const firstProjects = new ProjectRegistry(firstStores.projectStore);
    const firstSessions = new SessionRegistry(firstStores.sessionStore, firstStores.messageStore);
    const firstRouter = new MessageRouter(firstProjects, firstSessions);

    await firstProjects.register({
      id: "Chatty App",
      name: "Chatty App",
      rootPath: workspace,
      aliases: ["chatty"],
      hints: ["router"],
      defaultBackend: "mock",
    });

    const firstRoute = await firstRouter.resolve({ message: "Work on chatty routing" });
    assert.ok("project" in firstRoute);

    const firstEnsure = await backend.ensureSession({
      project: firstRoute.project,
      session: firstRoute.session,
      history: firstRoute.history,
    });
    assert.equal(firstEnsure.state, "created");

    const firstBound = await firstSessions.bindBackendSession(firstRoute.session.id, firstEnsure.binding);
    const firstResponse = await backend.sendMessage({
      project: firstRoute.project,
      session: firstBound,
      backendSession: firstBound.backendSession!,
      history: firstRoute.history,
      message: "Work on chatty routing",
      routeDecision: firstRoute.decision,
    });

    await firstSessions.recordExchange({
      sessionId: firstBound.id,
      messages: [
        { role: "user", content: "Work on chatty routing", createdAt: "2026-01-01T00:00:00.000Z" },
        { role: "assistant", content: firstResponse.reply, createdAt: "2026-01-01T00:00:01.000Z" },
      ],
      summary: firstResponse.summary,
      backendSession: firstResponse.backendSession,
    });

    const reloadedStores = createJsonStores(workspace);
    const reloadedProjects = new ProjectRegistry(reloadedStores.projectStore);
    const reloadedSessions = new SessionRegistry(reloadedStores.sessionStore, reloadedStores.messageStore);
    const reloadedRouter = new MessageRouter(reloadedProjects, reloadedSessions);

    const secondRoute = await reloadedRouter.resolve({ message: "Continue chatty routing work" });
    assert.ok("project" in secondRoute);
    assert.equal(secondRoute.session.id, firstRoute.session.id);
    assert.equal(secondRoute.session.backendSession?.sessionId, firstEnsure.binding.sessionId);

    const secondEnsure = await backend.ensureSession({
      project: secondRoute.project,
      session: secondRoute.session,
      history: secondRoute.history,
    });
    assert.equal(secondEnsure.state, "existing");
    assert.equal(secondEnsure.binding.sessionId, firstEnsure.binding.sessionId);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import { BackendSessionRef, HiddenSessionRecord, ProjectDefinition, RouteDecision } from "../../../core/src";
import { PiSessionClient } from "../src/client";
import { PiBackendAdapter } from "../src/index";

test("PiBackendAdapter ensures and sends through the Pi client contract", async () => {
  const calls: string[] = [];
  const project: ProjectDefinition = {
    id: "chatty",
    name: "chatty",
    rootPath: "D:\\Projects\\chatty",
    aliases: ["chatty"],
    hints: ["router"],
    defaultBackend: "pi",
  };
  const session: HiddenSessionRecord = {
    id: "hidden-1",
    projectId: "chatty",
    backend: "pi",
    title: "chatty hidden session",
    summary: "Fresh hidden session.",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: "2026-01-01T00:00:00.000Z",
    messageCount: 0,
  };
  const routeDecision: RouteDecision = {
    projectId: "chatty",
    action: "create",
    confidence: 0.9,
    evidence: [],
    candidates: [],
    session,
  };
  const binding: BackendSessionRef = {
    sessionId: "pi-session-1",
    sessionFile: "D:\\chatty\\.chatty\\backends\\pi\\projects\\chatty\\session.jsonl",
    boundAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: "2026-01-01T00:00:00.000Z",
  };

  const client: PiSessionClient = {
    async ensureSession(input) {
      calls.push(`ensure:${input.hiddenSessionId}`);
      return {
        sessionId: binding.sessionId,
        sessionFile: binding.sessionFile,
      };
    },
    async prompt(input) {
      calls.push(`prompt:${input.backendSession.sessionId}`);
      return {
        reply: "Pi replied with a routed answer.",
        backendSession: {
          sessionId: input.backendSession.sessionId,
          sessionFile: input.backendSession.sessionFile,
        },
      };
    },
  };

  const adapter = new PiBackendAdapter(client);
  const ensured = await adapter.ensureSession({
    project,
    session,
    history: [],
  });

  assert.equal(ensured.binding.sessionId, binding.sessionId);
  assert.equal(ensured.binding.sessionFile, binding.sessionFile);
  assert.equal(ensured.state, "created");

  const sent = await adapter.sendMessage({
    project,
    session: {
      ...session,
      backendSession: binding,
    },
    backendSession: binding,
    history: [],
    message: "Help with chatty routing",
    routeDecision,
  });

  assert.equal(sent.reply, "Pi replied with a routed answer.");
  assert.equal(sent.backendSession?.sessionFile, binding.sessionFile);
  assert.match(sent.summary, /chatty:/);
  assert.deepEqual(calls, ["ensure:hidden-1", "prompt:pi-session-1"]);
});

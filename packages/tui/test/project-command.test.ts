import test from "node:test";
import assert from "node:assert/strict";

import { parseProjectAddArgs, parseProjectBackendArgs } from "../src/commands/project-command";

test("parseProjectAddArgs supports explicit backend selection", () => {
  const parsed = parseProjectAddArgs([
    "chatty",
    "D:\\Projects\\chatty",
    "--backend",
    "pi",
    "router",
    "main-app",
  ]);

  assert.ok(!("error" in parsed));
  assert.equal(parsed.projectId, "chatty");
  assert.equal(parsed.rawPath, "D:\\Projects\\chatty");
  assert.equal(parsed.backend, "pi");
  assert.deepEqual(parsed.aliases, ["router", "main-app"]);
});

test("parseProjectAddArgs rejects unknown backends", () => {
  const parsed = parseProjectAddArgs([
    "chatty",
    "D:\\Projects\\chatty",
    "--backend",
    "weird",
  ]);

  assert.ok("error" in parsed);
  assert.match(parsed.error, /Unknown backend/);
});

test("parseProjectBackendArgs validates backend updates", () => {
  const parsed = parseProjectBackendArgs(["chatty", "pi"]);

  assert.ok(!("error" in parsed));
  assert.equal(parsed.projectId, "chatty");
  assert.equal(parsed.backend, "pi");
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRegistry } from "../src/registries/project-registry";

test("ProjectRegistry normalizes ids on register and lookup", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "chatty-projects-"));

  try {
    const registry = new ProjectRegistry(workspace);
    const registered = await registry.register({
      id: "My App",
      name: "My App",
      rootPath: "D:\\Projects\\My App",
      aliases: ["My App", "app"],
      hints: ["marketing site"],
      defaultBackend: "mock",
    });

    assert.equal(registered.id, "my-app");

    const byRawId = await registry.get("My App");
    const byNormalizedId = await registry.get("my-app");

    assert.equal(byRawId?.id, "my-app");
    assert.equal(byNormalizedId?.id, "my-app");
    assert.equal((await registry.list()).length, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

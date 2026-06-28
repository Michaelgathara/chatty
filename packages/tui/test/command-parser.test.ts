import test from "node:test";
import assert from "node:assert/strict";

import { tokenizeCommand } from "../src/commands/command-parser";

test("tokenizeCommand keeps quoted Windows paths together", () => {
  const tokens = tokenizeCommand('/project add "My App" "D:\\Projects\\My App" alias-one "site repo"');

  assert.deepEqual(tokens, [
    "/project",
    "add",
    "My App",
    "D:\\Projects\\My App",
    "alias-one",
    "site repo",
  ]);
});

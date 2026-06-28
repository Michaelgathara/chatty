import test from "node:test";
import assert from "node:assert/strict";

import { createPiBackendError } from "../src/errors";

test("createPiBackendError explains missing model configuration", () => {
  const error = createPiBackendError("prompt", new Error("No model selected"));

  assert.match(error.message, /model/i);
  assert.match(error.message, /configure/i);
});

test("createPiBackendError explains authentication failures", () => {
  const error = createPiBackendError("ensure-session", new Error("No API key available for provider"));

  assert.match(error.message, /authenticate/i);
  assert.match(error.message, /Pi/i);
});

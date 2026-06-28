import test from "node:test";
import assert from "node:assert/strict";

import {
  CHATTY_ROUTE_COMMAND,
  buildRouteCommand,
  parseRouteCommandArgs,
} from "../src/route-command";

test("buildRouteCommand and parseRouteCommandArgs round-trip a routed prompt", () => {
  const command = buildRouteCommand({
    projectId: "website",
    message: "Fix the landing page hero copy",
  });

  assert.match(command, new RegExp(`^/${CHATTY_ROUTE_COMMAND} `));

  const args = command.slice(`/${CHATTY_ROUTE_COMMAND} `.length);
  const parsed = parseRouteCommandArgs(args);

  assert.ok(!("error" in parsed));
  assert.equal(parsed.projectId, "website");
  assert.equal(parsed.message, "Fix the landing page hero copy");
});

test("parseRouteCommandArgs rejects invalid payloads", () => {
  const parsed = parseRouteCommandArgs("not-valid-base64");

  assert.ok("error" in parsed);
  assert.match(parsed.error, /decoded/i);
});

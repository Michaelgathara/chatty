import test from "node:test";
import assert from "node:assert/strict";

import { extractPiReply } from "../src/message-extractor";

test("extractPiReply prefers streamed deltas when available", () => {
  const reply = extractPiReply({
    streamedText: "Hello from Pi",
    agentEndMessages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "Fallback text" }],
      },
    ],
  });

  assert.equal(reply, "Hello from Pi");
});

test("extractPiReply falls back to assistant messages from agent_end", () => {
  const reply = extractPiReply({
    streamedText: "",
    agentEndMessages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "Assistant reply from agent end" }],
      },
    ],
  });

  assert.equal(reply, "Assistant reply from agent end");
});

test("extractPiReply can unwrap nested assistant message payloads", () => {
  const reply = extractPiReply({
    streamedText: "",
    sessionMessages: [
      {
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Nested assistant reply" }],
        },
      },
    ],
  });

  assert.equal(reply, "Nested assistant reply");
});

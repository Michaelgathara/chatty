# chatty

`chatty` is a terminal-first prototype for a single visible chat that routes each message into the right hidden project session.

## What exists today

- A TypeScript control plane for:
  - project registration
  - hidden-session persistence
  - heuristic message routing
  - backend adapters
- A runnable terminal app in `packages/tui/src/cli.ts`
- A local mock backend that proves the routing model without depending on an external AI tool yet
- Scaffold adapters for `Pi` and `OpenCode`

## Why the mock backend exists

The first implementation goal is to prove the product thesis: one composer, many isolated hidden sessions, explicit routing evidence, and durable state across restarts. The mock backend makes that testable before wiring real agent APIs.

## Quickstart

```bash
npm install
npm run dev
```

Inside the app:

- `/projects` shows known projects
- `/project add <id> <path> [aliases...]` registers another project. Quote ids or paths that contain spaces.
- `/use <projectId|auto>` pins or unpins routing
- `/sessions` shows hidden session state

Try this flow:

1. Register a second project with `/project add`.
2. Send one message mentioning the first project.
3. Send the next message about the second project.
4. Inspect `/sessions` to confirm the turns were isolated.

## Repo layout

- `docs/vision.md` - product thesis and MVP scope
- `docs/starter-eval.md` - current comparison of Pi, OpenCode, and a fresh build
- `docs/adr/0001-router-owns-session-selection.md` - architectural decision record
- `packages/core/src/registries` - project and hidden-session persistence
- `packages/core/src/routing` - message routing logic
- `packages/core/src/types` - shared core types
- `packages/core/src/utils` - focused core helpers
- `packages/core/test` - core tests
- `packages/backends` - backend adapters
- `packages/tui/src` - terminal app
- `packages/tui/src/commands` - command parsing helpers
- `packages/tui/test` - TUI tests
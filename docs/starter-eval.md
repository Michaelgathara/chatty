# Starter Evaluation

## Summary

`Pi` still looks like the best first real backend for `chatty`, but the current repo implementation keeps the backend replaceable and uses a local mock adapter until the external session API wiring is done.

## Pi

### Why it fits

- Terminal-native and minimal
- Designed for extensions and packages instead of a fixed workflow
- Does not force a visible subagent or plan/build UX on top of the user
- Good philosophical match for "one simple chat window"

### Risks

- Session APIs still need to be mapped cleanly into `chatty`'s own registry
- We need to confirm that hidden-session create/resume flows are ergonomic enough for a router-controlled UX

### Current status

- Adapter scaffold exists in `packages/backends/pi/src/index.ts`
- Real create/resume/send integration is not wired yet

## OpenCode

### Why it is still valuable

- Strong session model
- Plugin hooks
- Better documented lifecycle concepts around compaction and session state

### Risks

- More opinionated session and agent UX
- Plan/build/subagent concepts may leak into the experience we are trying to keep simple

### Current status

- Adapter scaffold exists in `packages/backends/opencode/src/index.ts`
- No live integration yet

## Fresh Build

### Why it remains on the table

- Maximum product control
- No UX leakage from someone else's session model
- Easier to align every primitive with the router thesis

### Risks

- Too much surface area for a greenfield repo
- Slower path to validating whether users even want this interaction model

## Current Decision

Build the control plane first and keep the first runnable prototype backend-agnostic.

That is what the current codebase does:

- `packages/core/src` owns project, session, and routing logic
- `packages/tui/src` owns the visible composer
- `packages/backends/mock/src` proves hidden-session switching today

Once the control plane feels right, wire `Pi` first and use `OpenCode` as the comparison backend.

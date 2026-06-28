# ADR 0001: Router Owns Session Selection

## Status

Accepted

## Context

The product thesis for `chatty` is a single visible chat that silently resumes or creates the correct hidden session per project. If session selection lives inside the backend agent, `chatty` becomes a thin wrapper around someone else's UX choices.

That would make it harder to guarantee:

- isolated context per project
- consistent routing explanations
- backend portability
- explicit override controls

## Decision

`chatty` owns session selection.

The router decides:

- which project a message belongs to
- whether to resume or create a hidden session
- what routing evidence to store and display

Backends only receive an already-resolved project and session.

## Consequences

### Positive

- Backend integrations stay replaceable.
- Routing behavior is consistent across Pi, OpenCode, and future backends.
- Session persistence can be audited from one local state store.

### Negative

- `chatty` must maintain its own persistent registry even when the backend also has sessions.
- Adapter work becomes slightly more complex because local session ids and backend session ids may need mapping.

## Implementation Notes

- `packages/core/src/router.ts` owns route selection.
- `packages/core/src/session-registry.ts` owns durable hidden-session state.
- Backend adapters should eventually persist external session references alongside the local session record.

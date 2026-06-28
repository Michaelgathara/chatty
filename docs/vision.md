# Vision

## Thesis

The main interaction model should be one visible chat surface that silently routes each user message into the correct hidden project session.

The user should not need to remember which chat belongs to which repo, task, or branch. The router should do that work and explain itself when confidence is low.

## Core Product Invariants

1. One visible composer is the default UX.
2. Every hidden session belongs to one project thread at a time.
3. Routing decisions are inspectable and overridable.
4. Context bleed across unrelated projects is a bug.
5. Session continuity must survive app restarts.

## MVP Scope

The first MVP proves the control plane rather than full backend intelligence.

That means:

- register multiple projects
- route messages with lightweight heuristics
- create or resume one hidden session per project/backend pair
- persist project and session state on disk
- show routing evidence to build user trust

The MVP does not need:

- embeddings
- semantic retrieval
- autonomous project discovery
- multi-backend failover
- polished UI beyond a useful terminal loop

## Current Approach

`chatty` owns the following layers:

- project registry
- session registry
- message router
- backend adapter interface

Backend tools such as `Pi` or `OpenCode` should plug into that control plane instead of owning routing themselves.

## Success Criteria

- A user can register at least two projects.
- Two consecutive prompts about different repos route without manual chat switching.
- Hidden sessions stay isolated and are visible in session state.
- The app explains why it picked a project and allows an override when needed.
- Swapping the backend does not require rewriting the router.

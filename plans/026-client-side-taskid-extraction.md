# 026: Move taskId extraction from agent-server to client

## Context

`getSessionSummary` in agent-server scans JSONL session files for `<start_task>` XML tags to extract taskId. This is Ralph-specific domain logic that doesn't belong in a generic agent server. The `parseTaskLifecycleEvent` function is duplicated across agent-server, agent-view, and cli. `findIncompleteSession` is dead code (only called from its own tests).

## Plan

### 1. Create client-side taskId extraction + localStorage cache

**New file: `packages/ui/src/lib/sessionTaskIdCache.ts`**

Pure function + cache layer:
- `extractTaskIdFromEvents(events: ChatEvent[]): string | undefined` — iterates events, uses `extractTaskLifecycleEvent` (already exists in `packages/ui/src/lib/extractTaskLifecycleEvent.ts`) to find the first `start_task` marker
- `getSessionTaskId(sessionId: string): string | undefined` — reads from localStorage cache
- `setSessionTaskId(sessionId: string, taskId: string): void` — writes to localStorage cache
- localStorage key: `ralph:sessionTaskIds` → `Record<string, string>`

### 2. Update `fetchRalphSessions` to use client-side cache

In `packages/ui/src/lib/fetchRalphSessions.ts`:
- Stop requesting `include=summary` (use `GET /api/sessions?app=ralph` instead)
- After fetching session list, read taskIds from localStorage cache
- For sessions without a cached taskId, fetch events via `fetchSessionEvents`, extract taskId, cache it
- Use `Promise.all` for parallel event fetches (bounded to uncached sessions only)
- Resolved task titles still come from the local `tasks` array (no change)

### 3. Populate cache from streaming events

In `useRalphSessions` or wherever streaming events are consumed:
- When a `task_lifecycle` event with `action: "starting"` is seen for the current session, write to cache
- This means active sessions get cached immediately, no extra fetch needed on next load

### 4. Remove Ralph-specific code from agent-server

- **Delete** `packages/agent-server/src/lib/getSessionSummary.ts` and its test
- **Delete** `packages/agent-server/src/lib/parseTaskLifecycleEvent.ts`
- **Delete** `packages/agent-server/src/lib/findIncompleteSession.ts` and its test (dead code)
- **Update** `packages/agent-server/src/routes.ts`: remove `getSessionSummary` import and the `taskId` branch from the `include=summary` handler

### 5. Keep `firstUserMessage` extraction on the server

`firstUserMessage` is generic (not Ralph-specific) and used by task-chat session picker. Two options:
- **Option A**: Keep `include=summary` but only extract `firstUserMessage` (inline the logic in routes.ts since it's trivial — find first `user_message` event)
- **Option B**: Move `firstUserMessage` to client-side too

Proposing **Option A** — `firstUserMessage` is generic enough to stay server-side, and it avoids touching the task-chat flow.

### 6. Update tests

- **Delete** `packages/agent-server/src/lib/tests/getSessionSummary.test.ts`
- **Delete** `packages/agent-server/src/lib/tests/findIncompleteSession.test.ts`
- **Add** tests for `sessionTaskIdCache.ts` (pure function + localStorage mocking)
- **Update** `packages/ui/src/lib/tests/fetchRalphSessions.test.ts` — no longer expects `taskId` from server response; instead mock `fetchSessionEvents` + localStorage

## Files to modify

- `packages/ui/src/lib/sessionTaskIdCache.ts` (new)
- `packages/ui/src/lib/fetchRalphSessions.ts`
- `packages/ui/src/hooks/useRalphSessions.ts`
- `packages/agent-server/src/routes.ts`
- `packages/agent-server/src/lib/getSessionSummary.ts` (delete)
- `packages/agent-server/src/lib/parseTaskLifecycleEvent.ts` (delete)
- `packages/agent-server/src/lib/findIncompleteSession.ts` (delete)
- Tests for all of the above

## Verification

1. `pnpm typecheck` passes
2. `pnpm test:unit` passes
3. `pnpm dev` — session picker shows task IDs and titles for sessions
4. Clear localStorage, reload — sessions initially show without taskIds, then populate as events are fetched
5. Watch a new session stream — taskId appears in picker as `<start_task>` arrives

## Open questions

1. Should `firstUserMessage` also move client-side, or is it fine staying in the server?
2. The parallel event fetches for uncached sessions on cold start could be N requests. In practice session counts are small, but should we add a concurrency limit?

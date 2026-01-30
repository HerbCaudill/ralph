# Agent-view architecture: canonical event schema + package restructuring

## Current state

- **agent-view** — React components, renders `ChatEvent` types. Has Ralph-specific components (TaskLifecycleEvent, PromiseCompleteEvent) and parsers hardcoded into the rendering pipeline.
- **agent-view-claude / agent-view-codex** — Pure event translators (native SDK → `ChatEvent`). Client-side. Not used by the server.
- **ralph-shared/events** — `AgentEvent` types + wire envelope types. Used by the UI server for WebSocket broadcasting.
- **UI server** (packages/ui/server/) — Mostly deleted. Had its own adapter layer (separate from agent-view adapters) for process management + event normalization.

## Target architecture

Two generic packages + Ralph as a consumer:

### `agent-view` (client)
- React components for rendering canonical events
- Canonical event schema defined with Effect Schema (single source of truth for types + runtime validation)
- Plugin system: `customEventRenderers` map for unknown event types
- Core event types rendered natively; unknown types looked up in renderer map or discarded
- No Ralph-specific knowledge

### `agent-view-server` (server, new package)
- Agent adapter interface with process lifecycle: `start()` → `AsyncIterable<CanonicalEvent>`, `stop()`, `sendMessage()`
- Adapters normalize native SDK events to canonical schema using Effect Schema transforms
- Every event gets guaranteed `id` (GUID) + `timestamp` via schema defaults
- WebSocket broadcasting + reconnection protocol
- Imports canonical schema from `agent-view`

### Ralph (consumer)
- Configures agent-view-server with adapter choice (Claude/Codex)
- Post-processes adapter output stream to inject custom events (task_lifecycle, promise_complete) by parsing XML markers from text
- Registers custom event renderers with agent-view for those types
- Owns all Ralph-specific components (TaskLifecycleEvent, PromiseCompleteEvent, session events)

### Adapter packages (agent-view-claude, agent-view-codex)
- Become server-side (depend on agent-view for schema, implement agent-view-server adapter interface)
- Output canonical events using Effect Schema encode
- Handle SDK-specific process lifecycle

## Canonical event schema (Effect Schema)

```ts
// Base — every event has these, guaranteed by schema defaults
const BaseEvent = S.Struct({
  id: S.String.pipe(S.propertySignature, S.withDefault(() => crypto.randomUUID())),
  timestamp: S.Number.pipe(S.propertySignature, S.withDefault(() => Date.now())),
  type: S.String,
})

// Core types agent-view renders natively
const MessageEvent = BaseEvent.pipe(S.extend(S.Struct({
  type: S.Literal("message"),
  content: S.String,
  isPartial: S.optional(S.Boolean),
})))

const ToolUseEvent = BaseEvent.pipe(S.extend(S.Struct({
  type: S.Literal("tool_use"),
  toolUseId: S.String,
  tool: S.String,
  input: S.Record({ key: S.String, value: S.Unknown }),
})))

// ... etc for tool_result, result, error, thinking, status

// Union of known types + catch-all for custom types
const CanonicalEvent = S.Union(MessageEvent, ToolUseEvent, /* ... */, UnknownEvent)
```

The `type` field is `string` (open), not a closed union. Unknown types decode into a generic shape that custom renderers can handle.

## Plugin system for custom renderers

```tsx
<AgentViewProvider
  customEventRenderers={{
    task_lifecycle: (event) => <TaskLifecycleEvent event={event} />,
    promise_complete: (event) => <PromiseCompleteEvent event={event} />,
  }}
>
```

In agent-view's rendering pipeline: check `customEventRenderers[event.type]` before falling back to built-in renderers. Unknown types with no renderer are silently discarded.

## Migration scope

This is a multi-step effort. Proposed ordering:

### Phase 1: Schema + move events to agent-view (do now)
1. Add `effect` + `@effect/schema` deps to agent-view
2. Define canonical event schema in `agent-view/src/events/` using Effect Schema
3. Export schema, types, and decode/encode utilities from agent-view
4. Remove core event types from ralph-shared (keep wire envelope types, re-export from agent-view for backward compat)
5. Add `customEventRenderers` to AgentViewContext
6. Move Ralph-specific components (TaskLifecycleEvent, PromiseCompleteEvent, parsers) out of agent-view into packages/ui
7. Wire up customEventRenderers in Ralph's AgentViewProvider

### Phase 2: Server extraction (future)
1. Create agent-view-server package
2. Define server-side adapter interface (process lifecycle + canonical event output)
3. Move WebSocket broadcast + reconnection protocol from packages/ui/server
4. Migrate agent-view-claude and agent-view-codex to implement new server adapter interface

### Phase 3: Full integration (future)
1. Ralph consumes agent-view-server
2. Remove duplicate adapter code from Ralph UI server
3. Remove ralph-shared/events entirely (all types live in agent-view or agent-view-server)

## Files to modify (Phase 1)

### New files
- `packages/agent-view/src/events/schema.ts` — Effect Schema definitions
- `packages/agent-view/src/events/types.ts` — Inferred TypeScript types from schema
- `packages/agent-view/src/events/guards.ts` — Type guards (can derive from schema)
- `packages/agent-view/src/events/index.ts` — Re-exports

### Modified files
- `packages/agent-view/package.json` — Add effect deps
- `packages/agent-view/src/index.ts` — Export events module
- `packages/agent-view/src/context/AgentViewContext.ts` — Add customEventRenderers
- `packages/agent-view/src/components/StreamingBlockRenderer.tsx` — Use customEventRenderers instead of hardcoded lifecycle/promise rendering
- `packages/agent-view/src/lib/renderEventContentBlock.tsx` — Same
- `packages/shared/src/events/types.ts` — Trim to wire protocol, re-export core from agent-view
- `packages/shared/src/events/guards.ts` — Trim to wire protocol guards
- `packages/shared/package.json` — Add agent-view dep

### Moved to packages/ui (Ralph-specific)
- TaskLifecycleEvent component + parseTaskLifecycleEvent
- PromiseCompleteEvent component + parsePromiseCompleteEvent
- Related types (TaskLifecycleChatEvent, PromiseCompleteChatEvent)

## Verification
1. `pnpm build` — all packages compile
2. `pnpm test:all` — existing tests pass
3. `pnpm typecheck` — no type errors
4. Storybook — components render correctly
5. Dev server — events render in browser with custom renderers

# 021: UI Package Rebuild Plan

Fresh rebuild of `packages/ui/` using modular building blocks.

## Approach

1. Rename `packages/ui/` → `packages/ui-deprecated/`
2. Create new `packages/ui/` from scratch (use `/scaffold` skill)
3. Steal useful pieces from deprecated package as needed
4. Push as much as possible to generic packages (agent-view, beads-view)

## Core Insight

Ralph and task-chat are structurally identical - just different system prompts and loop behavior:

| Aspect        | Task Chat                                | Ralph                            |
| ------------- | ---------------------------------------- | -------------------------------- |
| System prompt | manage-tasks skill                       | core + workflow                  |
| Context files | Adapter-specific (CLAUDE.md / AGENTS.md) | Adapter-specific                 |
| Loop behavior | Wait for user input                      | Auto-continue on task completion |
| Trigger       | User sends message                       | Ready task in beads              |

## Session Isolation

Task-chat and ralph must have completely independent sessions. This requires changes to agent-server.

### Required: App-namespaced sessions

**Connection:** WebSocket accepts `app` parameter:

```
/ws?app=ralph
/ws?app=task-chat
```

**Storage:** Sessions stored in separate directories:

```
.agent-server/
  sessions/
    ralph/
      session-abc123.jsonl
    task-chat/
      session-xyz789.jsonl
```

**Session IDs:** Globally unique (UUID), but scoped to app for listing:

```
GET /api/sessions?app=ralph      → ralph sessions only
GET /api/sessions?app=task-chat  → task-chat sessions only
GET /api/sessions                → all sessions (backward compat)
```

**WebSocket protocol changes:**

```typescript
// Client connects with app
ws.connect("/ws?app=ralph")

// Session start includes system prompt
{
  type: "session:start",
  sessionId?: string,        // Optional: resume existing session
  systemPrompt?: string,     // Optional: set/override system prompt
}

// Events are scoped to the connected app
```

**Adapter selection:** App can specify adapter:

```
/ws?app=ralph&adapter=claude
/ws?app=task-chat&adapter=claude
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Shared Worker                          │   │
│  │  - Owns ralph WebSocket (app=ralph)                      │   │
│  │  - Owns ralph loop state (running/paused/stopped)        │   │
│  │  - Watches beads for ready tasks                         │   │
│  │  - Auto-starts new session on task completion            │   │
│  │  - Broadcasts events to tabs                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                              │                        │
│  ┌──────┴──────┐              ┌────────┴────────┐              │
│  │  Task Chat  │              │  Ralph Runner   │              │
│  │ useAgentChat│              │  useAgentChat   │              │
│  │ (task-chat) │              │  (via worker)   │              │
│  │ own WS conn │              │                 │              │
│  └─────────────┘              └─────────────────┘              │
└────────┬────────────────────────────┬──────────────────────────┘
         │                            │
         │                       ┌────┴────┐
         │                       │  agent  │
         └───────────────────────│ server  │
                                 │ (4244)  │
                                 └─────────┘
```

## Package Responsibilities

### agent-view (generic)

Add loop control functionality:

```typescript
// New hook for agent control (used by agent-demo too)
function useAgentControl() {
  return {
    state: "stopped" | "running" | "paused",
    start: () => void,
    pause: () => void,
    resume: () => void,
    stop: () => void,
  }
}
```

New components:

- `AgentControls` - Start/pause/stop buttons
- `SessionPicker` - Session history dropdown

### beads-view (generic)

- `useWorkspace()` hook (move from beads-demo)

### agent-server

1. **App-namespaced storage** - Sessions stored by app
2. **WebSocket app parameter** - Route connections by app
3. **System prompt injection** - Accept prompt on session start
4. **Prompt assembly endpoint** - `GET /api/prompt?app=ralph&workspace=...`

Context file loading is adapter-specific:

- Claude: `CLAUDE.md` in `.claude/` directories
- Codex: `AGENTS.md` in `.codex/` directories

### ui (new, thin)

Ralph-specific orchestration only:

- Shared worker for ralph loop automation
- Layout composition (task sidebar + ralph runner + task chat)
- Workspace switching UI
- Theme integration

## Implementation Phases

### Phase 1: agent-server - Session isolation

**Files:**

- `packages/agent-server/src/SessionPersister.ts` - Add app namespace to paths
- `packages/agent-server/src/ChatSessionManager.ts` - Scope sessions by app
- `packages/agent-server/src/wsHandler.ts` - Parse `app` query param, route accordingly
- `packages/agent-server/src/routes.ts` - Add `app` filter to session list endpoint

### Phase 2: agent-server - System prompt injection

**Files:**

- `packages/agent-server/src/wsHandler.ts` - Accept `systemPrompt` in `session:start`
- `packages/agent-server/src/ChatSessionManager.ts` - Store prompt with session
- `packages/agent-server/src/routes/promptRoutes.ts` - NEW: `GET /api/prompt`
- `packages/agent-server/src/lib/loadPrompt.ts` - NEW: Prompt assembly logic
- `packages/agent-server/src/lib/loadContextFile.ts` - NEW: Adapter-specific context file loading

### Phase 3: agent-view - Control components

**Files:**

- `packages/agent-view/src/hooks/useAgentControl.ts` - NEW
- `packages/agent-view/src/components/AgentControls.tsx` - NEW
- `packages/agent-view/src/components/SessionPicker.tsx` - NEW
- `packages/agent-view/src/hooks/useAgentChat.ts` - Integrate control

**Update agent-demo** to use new controls.

### Phase 4: beads-view - useWorkspace

**Files:**

- `packages/beads-view/src/hooks/useWorkspace.ts` - Move from beads-demo

### Phase 5: UI - Fresh package

Use `/scaffold` skill to create new package, then add:

- Shared worker for ralph loop (`workers/ralphWorker.ts`)
- `useRalphLoop()` hook
- Layout components (MainLayout, RalphRunner with built-in footer, TaskChatPanel)
- Minimal UI store

### Phase 6: Cleanup

1. Remove `packages/ui-deprecated/`
2. Remove `packages/ralph-server/` (no longer needed)
3. Update root package.json scripts

## Verification

1. **agent-server isolation:** Two apps have independent sessions
2. **agent-demo with controls:** Pause/resume works, session picker shows history
3. **Full UI:** Ralph loop + task chat work independently, workspace switching works

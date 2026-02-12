# Server Responsibilities Map

> This document catalogs all routes, WebSocket channels, and shared types in the current
> `packages/ui/server/` codebase to guide the split into separate **beads-server** and
> **agent-server** packages.

## HTTP Routes

### Health & Infrastructure

| Method | Route               | Description                            | Category       |
| ------ | ------------------- | -------------------------------------- | -------------- |
| `GET`  | `/healthz`          | Health check                           | Infrastructure |
| `POST` | `/api/state/export` | Export server state to file (dev only) | Infrastructure |
| `GET`  | `/{*splat}`         | Serve static assets / SPA fallback     | Infrastructure |

### Agent Control — Legacy (Singleton)

These operate on the active workspace's singleton `RalphManager`:

| Method | Route                            | Description                          |
| ------ | -------------------------------- | ------------------------------------ |
| `POST` | `/api/start`                     | Start Ralph CLI process              |
| `POST` | `/api/stop`                      | Stop Ralph CLI process               |
| `POST` | `/api/pause`                     | Pause after current session          |
| `POST` | `/api/resume`                    | Resume from paused state             |
| `POST` | `/api/stop-after-current`        | Stop after current session completes |
| `POST` | `/api/cancel-stop-after-current` | Cancel pending stop, restart Ralph   |
| `POST` | `/api/message`                   | Send message to Ralph CLI via stdin  |
| `GET`  | `/api/status`                    | Get current Ralph status             |

### Agent Control — Instance-Scoped

These operate on specific Ralph instances (supports concurrent agents in separate worktrees):

| Method   | Route                                              | Description                   |
| -------- | -------------------------------------------------- | ----------------------------- |
| `GET`    | `/api/instances`                                   | List all registered instances |
| `POST`   | `/api/instances`                                   | Create a new instance         |
| `GET`    | `/api/ralph/:instanceId`                           | Get a specific instance       |
| `DELETE` | `/api/ralph/:instanceId`                           | Delete an instance            |
| `GET`    | `/api/ralph/:instanceId/status`                    | Get instance status           |
| `POST`   | `/api/ralph/:instanceId/start`                     | Start instance                |
| `POST`   | `/api/ralph/:instanceId/stop`                      | Stop instance                 |
| `POST`   | `/api/ralph/:instanceId/pause`                     | Pause instance                |
| `POST`   | `/api/ralph/:instanceId/resume`                    | Resume instance               |
| `POST`   | `/api/ralph/:instanceId/stop-after-current`        | Stop after current session    |
| `POST`   | `/api/ralph/:instanceId/cancel-stop-after-current` | Cancel pending stop           |
| `POST`   | `/api/ralph/:instanceId/message`                   | Send message to instance      |
| `GET`    | `/api/ralph/:instanceId/events`                    | Get event history             |
| `DELETE` | `/api/ralph/:instanceId/events`                    | Clear event history           |
| `GET`    | `/api/ralph/:instanceId/current-task`              | Get the current task          |

### Session State Restoration

| Method   | Route                                  | Description                  |
| -------- | -------------------------------------- | ---------------------------- |
| `GET`    | `/api/ralph/:instanceId/session-state` | Get saved session state      |
| `POST`   | `/api/ralph/:instanceId/restore-state` | Restore conversation context |
| `DELETE` | `/api/ralph/:instanceId/session-state` | Delete saved session state   |

### Task Chat (AI Chat about Tasks)

| Method | Route                     | Description                                 |
| ------ | ------------------------- | ------------------------------------------- |
| `POST` | `/api/task-chat/message`  | Send message to Claude (response via WS)    |
| `GET`  | `/api/task-chat/messages` | Get chat messages (client is authoritative) |
| `POST` | `/api/task-chat/clear`    | Clear chat history                          |
| `POST` | `/api/task-chat/cancel`   | Cancel current chat request                 |
| `GET`  | `/api/task-chat/status`   | Get task chat status                        |

### Task/Issue Management (Beads)

Registered via `registerTaskRoutes()` from `@herbcaudill/beads-view/server`:

| Method   | Route                          | Description            |
| -------- | ------------------------------ | ---------------------- |
| `GET`    | `/api/tasks`                   | List tasks             |
| `GET`    | `/api/tasks/blocked`           | Get blocked tasks      |
| `POST`   | `/api/tasks`                   | Create a task          |
| `GET`    | `/api/tasks/:id`               | Get single task        |
| `PATCH`  | `/api/tasks/:id`               | Update task            |
| `DELETE` | `/api/tasks/:id`               | Delete a task          |
| `GET`    | `/api/tasks/:id/labels`        | Get labels             |
| `POST`   | `/api/tasks/:id/labels`        | Add label              |
| `DELETE` | `/api/tasks/:id/labels/:label` | Remove label           |
| `POST`   | `/api/tasks/:id/blockers`      | Add blocker            |
| `DELETE` | `/api/tasks/:id/blockers/:bid` | Remove blocker         |
| `GET`    | `/api/labels`                  | List all unique labels |
| `GET`    | `/api/tasks/:id/comments`      | Get comments           |
| `POST`   | `/api/tasks/:id/comments`      | Add comment            |

### Workspace Management

| Method | Route                   | Description                     | Category |
| ------ | ----------------------- | ------------------------------- | -------- |
| `GET`  | `/api/workspace`        | Current workspace info          | Beads    |
| `GET`  | `/api/workspaces`       | List all alive workspaces       | Beads    |
| `POST` | `/api/workspace/switch` | Switch to a different workspace | Both     |

### Theme Routes

| Method | Route             | Description                   | Category       |
| ------ | ----------------- | ----------------------------- | -------------- |
| `GET`  | `/api/themes`     | List available VS Code themes | Infrastructure |
| `GET`  | `/api/themes/:id` | Get a parsed theme            | Infrastructure |

---

## WebSocket Channels

Single WebSocket endpoint at `/ws`.

### Inbound (Client → Server)

| Message Type             | Description                           | Category       |
| ------------------------ | ------------------------------------- | -------------- |
| `ping`                   | Heartbeat (server responds `pong`)    | Infrastructure |
| `ws:subscribe_workspace` | Subscribe to workspace events         | Infrastructure |
| `chat_message`           | Send chat message to Ralph via stdin  | Agent          |
| `agent:reconnect`        | Unified reconnection request          | Both           |
| `reconnect`              | Legacy reconnection (deprecated)      | Agent          |
| `task-chat:reconnect`    | Legacy task chat reconnection (depr.) | Agent          |

### Outbound (Server → Client)

#### Infrastructure

| Message Type         | Description                            |
| -------------------- | -------------------------------------- |
| `connected`          | Welcome with status and initial events |
| `instances:list`     | Full instance list on connect          |
| `pong`               | Heartbeat response                     |
| `ws:subscribed`      | Workspace subscription confirmation    |
| `error`              | Error message                          |
| `workspace_switched` | Active workspace changed               |

#### Agent Events

| Message Type              | Description                                   |
| ------------------------- | --------------------------------------------- |
| `agent:event`             | Unified envelope (source: ralph or task-chat) |
| `agent:pending_events`    | Reconnection catch-up                         |
| `ralph:status`            | Status change                                 |
| `ralph:output`            | Non-JSON stdout line                          |
| `ralph:error`             | Error from process                            |
| `ralph:exit`              | Process exited                                |
| `user_message`            | User message echoed to all clients            |
| `instance:created`        | New instance created                          |
| `instance:disposed`       | Instance disposed                             |
| `instance:merge_conflict` | Merge conflict detected                       |

#### Task Chat Events (legacy, deprecated)

| Message Type               | Description                 |
| -------------------------- | --------------------------- |
| `task-chat:message`        | Chat message                |
| `task-chat:chunk`          | Streaming text chunk        |
| `task-chat:status`         | Status change               |
| `task-chat:error`          | Error                       |
| `task-chat:tool_use`       | Tool use started            |
| `task-chat:tool_update`    | Tool use updated            |
| `task-chat:tool_result`    | Tool use completed          |
| `task-chat:cleared`        | Chat history cleared        |
| `pending_events`           | Legacy reconnection (depr.) |
| `task-chat:pending_events` | Legacy reconnection (depr.) |

#### Beads Events

| Message Type     | Description                        |
| ---------------- | ---------------------------------- |
| `mutation:event` | Task list change from beads daemon |

---

## Server Modules

| Module                  | File                           | Category | Description                                    |
| ----------------------- | ------------------------------ | -------- | ---------------------------------------------- |
| RalphManager            | `RalphManager.ts`              | Agent    | Spawns/manages Ralph CLI child process         |
| RalphRegistry           | `RalphRegistry.ts`             | Agent    | Multi-instance management, event history       |
| TaskChatManager         | `TaskChatManager.ts`           | Agent    | AI chat via Claude Agent SDK                   |
| AgentAdapter            | `AgentAdapter.ts`              | Agent    | Abstract base for agent adapters               |
| ClaudeAdapter           | `ClaudeAdapter.ts`             | Agent    | Claude-specific adapter                        |
| CodexAdapter            | `CodexAdapter.ts`              | Agent    | Codex-specific adapter                         |
| WorktreeManager         | `WorktreeManager.ts`           | Agent    | Git worktree creation/management               |
| InstanceStore           | `InstanceStore.ts`             | Agent    | File-based instance persistence                |
| SessionStateStore       | `SessionStateStore.ts`         | Agent    | Session conversation context persistence       |
| SessionEventPersister   | `SessionEventPersister.ts`     | Agent    | JSONL event persistence for reload recovery    |
| TaskChatEventLog        | `TaskChatEventLog.ts`          | Agent    | Task chat event logging                        |
| TaskChatEventPersister  | `TaskChatEventPersister.ts`    | Agent    | Task chat event persistence for reconnection   |
| SessionRunner           | `SessionRunner.ts`             | Agent    | Server-side session runner                     |
| BeadsClient             | `@herbcaudill/beads-sdk`       | Beads    | Beads SDK client (DaemonTransport)             |
| BeadsClient             | `BeadsClient.ts`               | Beads    | Wrapper around DaemonSocket for mutation watch |
| taskRoutes              | `beads-view/.../taskRoutes.ts` | Beads    | Express route registrations for tasks/labels   |
| WorkspaceContext        | `WorkspaceContext.ts`          | Both     | Per-workspace encapsulation (agent + beads)    |
| WorkspaceContextManager | `WorkspaceContextManager.ts`   | Both     | Registry of WorkspaceContexts                  |
| ThemeDiscovery          | `ThemeDiscovery.ts`            | UI       | VS Code theme discovery and parsing            |

---

## Shared Types

### From `@herbcaudill/ralph-shared` (packages/shared)

- `AgentEvent` — union of all agent event types
- `AgentEventBase`, `AgentMessageEvent`, `AgentThinkingEvent`, `AgentToolUseEvent`, `AgentToolResultEvent`, `AgentResultEvent`, `AgentErrorEvent`, `AgentStatusEvent`
- `AgentStatus` — `"idle" | "starting" | "running" | "paused" | "stopping" | "stopped"`
- `AgentEventSource` — `"ralph" | "task-chat"`
- `AgentEventEnvelope`, `AgentReconnectRequest`, `AgentPendingEventsResponse`

### From `@herbcaudill/beads-sdk`

- `BdIssue`, `BdDependency`, `BdListOptions`, `BdCreateOptions`, `BdUpdateOptions`
- `BdInfo`, `BdLabelResult`, `BdDepResult`, `BdComment`
- `IssueStatus` — `"open" | "in_progress" | "blocked" | "deferred" | "closed"`
- `MutationType`, `MutationEvent`
- `BeadsClient`

### Server-Local Types

- `RalphStatus`, `RalphEvent`, `RalphManagerOptions`, `SpawnFn` — from `RalphManager.ts`
- `TaskChatStatus`, `TaskChatMessage`, `TaskChatEvent`, `TaskChatToolUse` — from `TaskChatManager.ts`
- `RalphInstanceState`, `CreateInstanceOptions`, `MergeConflict` — from `RalphRegistry.ts`
- `ServerConfig`, `WsClient` — from `index.ts`
- `RegistryEntry`, `WorkspaceInfo` — from `types.ts`
- `PersistedInstance` — from `InstanceStore.ts`
- `PersistedSessionState` — from `SessionStateStore.ts`
- `AgentAdapter`, `AgentStartOptions`, `AgentMessage`, `AgentInfo` — from `AgentAdapter.ts`
- `TaskRouteBeadsClient`, `TaskRoutesOptions` — from `taskRoutes.ts`

---

## Proposed Split

### beads-server

- All `/api/tasks/*` and `/api/labels` routes
- `/api/workspace` and `/api/workspaces` routes
- `BeadsClient` — daemon socket communication
- `mutation:event` WebSocket broadcasts
- Workspace registry helpers

### agent-server

- All `/api/ralph/*` instance routes
- All `/api/task-chat/*` routes
- Legacy singleton routes (`/api/start`, `/api/stop`, etc.)
- All agent-related WebSocket messages
- `RalphManager`, `RalphRegistry`, `TaskChatManager`
- `AgentAdapter` / `ClaudeAdapter` / `CodexAdapter`
- `WorktreeManager`, `InstanceStore`, `SessionStateStore`
- Event persistence modules

### Key Coupling Point

`WorkspaceContext` tightly bundles both concerns (RalphManager + BeadsClient + TaskChatManager).
Splitting the server requires decomposing this class into two parts, or having both servers
share workspace path information while maintaining independent subsystem state.

Similarly, `/api/workspace/switch` touches both sides — it creates a new BeadsClient and
starts/stops Ralph instances.

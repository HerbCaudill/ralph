# @herbcaudill/agent-server

Standalone server for managing AI coding agents, extracted from the Ralph UI server. Provides HTTP and WebSocket APIs plus all core agent management modules.

## Extracted modules

| Module                    | Description                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **RalphManager**          | Spawns and manages a Ralph CLI child process. Emits `RalphEvent` on stdout/stderr and tracks `RalphStatus`.                                                                                      |
| **RalphRegistry**         | In-memory registry of all `RalphInstanceState` entries for a workspace. Handles instance creation, session lifecycle, agent adapter management, and conversation context extraction.             |
| **InstanceStore**         | JSON file persistence for instance metadata (`~/.ralph/instances/<workspace>.json`). Singleton per workspace via `getInstanceStore()`.                                                           |
| **SessionEventPersister** | Append-only JSONL persistence for agent events. Singleton per workspace via `getSessionEventPersister()`.                                                                                        |
| **SessionStateStore**     | JSON file persistence for session state (status, token counts, timing). Singleton per workspace via `getSessionStateStore()`.                                                                    |
| **SessionRunner**         | Orchestrates a single agent session: builds the system prompt, spawns the agent via its adapter, streams events, detects completion signals, and manages pause/resume.                           |
| **WorktreeManager**       | Creates and manages git worktrees for parallel agent sessions. Handles branch creation, merge back to the main branch, conflict detection, and cleanup.                                          |
| **findClaudeExecutable**  | Locates the `claude` CLI binary by searching PATH and common install locations.                                                                                                                  |
| **systemPrompt**          | Loads and assembles the system prompt from `core-prompt.md` and `.ralph/workflow.md`. Also provides task-chat skill config (`loadTaskChatSkill`, `getTaskChatAllowedTools`, `getTaskChatModel`). |
| **loadSkill**             | Loads custom skill definitions from `.ralph/skills/` directories. Returns skill metadata and content.                                                                                            |

## Type definitions (agentTypes.ts)

Provides framework-level types so agent-server modules avoid direct imports of concrete adapter implementations:

- **AgentAdapter** -- Abstract base class for agent adapters (Claude, Codex, etc.). Emits normalized `AgentEvent` and manages status transitions.
- **ConversationContext / ConversationMessage** -- Serializable conversation history for session persistence and restoration.
- **BdProxy** -- Minimal interface for the beads issue-tracking client used by RalphRegistry.
- **AgentStartOptions / AgentMessage / AgentInfo** -- Configuration and messaging types for agent adapters.

## Server

The package also exports an Express + WebSocket server (`startServer`, `getConfig`, `findAvailablePort`). Default port 4244, configurable via `AGENT_SERVER_PORT`.

```bash
# Development
pnpm dev

# Build
pnpm build

# Tests
pnpm test
```

## Re-export pattern

The UI server files (`packages/ui/server/*.ts`) re-export from `@herbcaudill/agent-server` so that existing imports within the UI package continue to work without changes.

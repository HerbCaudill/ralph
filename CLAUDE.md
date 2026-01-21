# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## User Input During Runtime

Ralph supports sending user messages to Claude while it's working:

- **Escape** - Opens a text input to send a message to Claude (only while running; press again to cancel)
- **Ctrl+T** - Opens a text input to add a todo item (only if todo.md exists)
- **Ctrl+S** - Stop gracefully after the current iteration completes
- **Ctrl+P** - Pause/resume: pause after current iteration completes, press again to resume

User-injected messages appear in the output stream with a 📨 prefix and green color, so users know their message was received and processed.

### Stdin Commands (JSON Mode)

When running in JSON mode (`ralph --json`), commands can be sent via stdin as JSON:

- `{"type": "message", "text": "..."}` - Send a message to Claude
- `{"type": "stop"}` - Stop gracefully after current iteration
- `{"type": "pause"}` - Pause after current iteration completes
- `{"type": "resume"}` - Resume from paused state

### Implementation Details

The feature uses the Claude Agent SDK's streaming input mode. Instead of passing a string prompt to `query()`, we pass a `MessageQueue` (an async iterable) that:

1. Yields the initial prompt message
2. Can receive additional messages pushed via `push()` from the UI
3. Uses promises to block iteration until new messages arrive

When a user sends a message via Escape:

1. The message is pushed to the MessageQueue for the SDK
2. A display event is added to the events state for visual feedback
3. The `eventToBlocks.ts` parser handles `user` type events and creates `user` content blocks
4. The `formatContentBlock.ts` formats user blocks with a distinctive style

See `src/lib/MessageQueue.ts` for the queue implementation.

## Debug Logging

Ralph has built-in debug logging to help diagnose issues like hangs. Enable it with the `RALPH_DEBUG` environment variable:

```bash
# Enable all debug logging
RALPH_DEBUG=1 ralph

# Enable specific namespace
RALPH_DEBUG=messagequeue ralph    # MessageQueue push/next/close operations
RALPH_DEBUG=iteration ralph       # Iteration lifecycle events

# Enable multiple namespaces
RALPH_DEBUG=messagequeue,iteration ralph
```

Debug logs are written to stderr with timestamps, so they don't interfere with the normal output.

---

## Project Overview

Ralph is an autonomous AI iteration engine that wraps the Claude CLI to run iterative development workflows. It spawns Claude CLI processes with a custom prompt and todo list, captures streaming JSON output, displays it in a formatted terminal UI using Ink (React for CLIs), and orchestrates multiple iterations.

## Key Architecture

### Core Flow

1. **CLI Entry** (`cli.ts`) → Defines Commander.js program with modes:
   - Main mode: Run N iterations (`ralph [iterations]`)
   - Watch mode: Watch for new beads issues after completion (`ralph --watch`)
   - Agent selection: Select AI agent to use (`ralph --agent <name>`, defaults to `claude`)
   - Init mode: Set up `.ralph/` directory (`ralph init`)
   - Replay mode: Replay events from log (`ralph --replay [file]`)

2. **Iteration Runner** (`IterationRunner.tsx`) → Core orchestration:
   - Reads prompt from `.ralph/prompt.md` or falls back to bundled templates
   - Spawns `claude` CLI with `--output-format stream-json`
   - Parses streaming JSON events line-by-line
   - Appends events to `.ralph/events.jsonl`
   - Detects `<promise>COMPLETE</promise>` to exit early (or enter watch mode if `--watch`)
   - Recursively runs next iteration after completion
   - In watch mode: polls beads daemon for new issues via Unix socket RPC

3. **Event Processing** (`eventToBlocks.ts`) → Transforms raw JSON events into display blocks:
   - Extracts tool calls (Read, Edit, Bash, Grep, Glob, TodoWrite, etc.)
   - Shortens file paths to relative paths
   - Formats tool arguments for display
   - Creates unique IDs for React keys

4. **Display Layer** (`EventDisplay.tsx`, `ToolUse.tsx`) → Renders events using Ink components

### Template System

Ralph initializes projects with template files in `.ralph/`:

- `prompt.md` - Instructions given to Claude each iteration (build commands, workflow) **(optional - falls back to bundled templates)**
- `todo.md` - Task list in markdown checkbox format **(optional)**
- `events.jsonl` - JSONL event stream for debugging/replay (auto-generated during runs)

Templates are copied from `templates/` directory on `ralph init`.

If no `.ralph/prompt.md` exists, Ralph automatically uses the appropriate bundled template:

- If `.beads` directory exists → uses `prompt-beads.md` (beads workflow)
- If `.ralph/todo.md` exists → uses `prompt-todos.md` (todo-based workflow)
- Otherwise → uses `prompt-beads.md` (default)

### The Contract with Claude CLI

Ralph expects Claude CLI to:

- Accept `@.ralph/prompt.md`, `@.ralph/todo.md` as context files
- Output `--output-format stream-json` with `--include-partial-messages`
- Exit with code 0 on success
- Output `<promise>COMPLETE</promise>` when todo list is complete

Claude is instructed (via `prompt.md`) to:

- Check build/tests first, fix errors if found
- Select one high-priority task from todo.md
- Complete the task, update todo.md
- Commit changes with git
- Output `<promise>COMPLETE</promise>` if todo list is empty

## Development Commands

```bash
# Build all packages
pnpm build

# Typecheck all packages
pnpm typecheck

# Run all tests across packages
pnpm test:all          # Run all tests (CLI + UI)
pnpm test              # Run tests in each package

# Run the CLI
pnpm cli               # Run ralph CLI in development
pnpm cli:build         # Build CLI package
pnpm cli:test          # Run CLI tests

# Run the UI
pnpm ui                # Start UI dev server (Vite)
pnpm serve             # Start server only
pnpm ui:build          # Build UI for production
pnpm ui:test           # Run UI tests
pnpm test:pw           # Run Playwright with dynamic ports (uses scripts/dev.js)
pnpm --filter @herbcaudill/ralph-ui dev:headless  # Start UI without opening a browser
# Playwright dev server output logs to ui/test-results/playwright-dev.log

# Run server + UI together
pnpm dev               # Start both server and UI concurrently

# Storybook
pnpm storybook         # Start Storybook for UI components

# Format code with Prettier
pnpm format

# Editor config
# Use ui/server/tsconfig.json when editing UI server TypeScript files

# Publish CLI + UI packages
pnpm pub

# UI package publishes as public
pnpm --filter @herbcaudill/ralph-ui publish --access public
```

## Workspace Structure

This is a pnpm workspace with three packages:

- **`cli/`** (`@herbcaudill/ralph`) - The CLI tool (published to npm)
- **`ui/`** (`@herbcaudill/ralph-ui`) - Web app with server and React frontend (published to npm)
- **`shared/`** (`@herbcaudill/ralph-shared`) - Shared utilities and types used by CLI and UI

### CLI Package (`cli/`)

The autonomous AI iteration engine that wraps Claude CLI:

- Spawns Claude CLI with custom prompts
- Captures streaming JSON output
- Displays formatted terminal UI using Ink (React for CLIs)
- Orchestrates multiple iterations

### UI Package (`ui/`)

Web app with integrated Express server and React frontend:

- **Server** (`ui/server/`):
  - REST API for workspace management
  - WebSocket server for real-time event streaming
  - `RalphManager` - Spawns and manages Ralph CLI processes
  - `BdProxy` - Proxy for beads CLI commands
  - `ClaudeAdapter`/`CodexAdapter` - SDK-backed agent adapters for Claude and Codex
  - Theme discovery from VS Code installations
- **Frontend** (`ui/src/`):
  - Real-time event stream viewer
  - Task chat shows tool uses and results during responses
  - Task sidebar with beads integration
  - Workspace switcher for multiple projects
  - Theme support (VS Code theme integration)
  - ToolUseCard renders Bash output as plain text after stripping ANSI codes
  - Bash tool output strips ANSI color codes before display

Run with `npx @herbcaudill/ralph-ui` after installing.

### Shared Package (`shared/`)

Shared utilities and types used by both CLI and UI packages:

- **Agent Events** (`events/`):
  - Normalized event types (`AgentMessageEvent`, `AgentToolUseEvent`, etc.)
  - Type guards (`isAgentMessageEvent`, `isAgentToolUseEvent`, etc.)
  - Status types (`AgentStatus`)
- **Beads Domain Types** (`beads/`):
  - Issue types (`BdIssue`, `BdDependency`)
  - Options types (`BdListOptions`, `BdCreateOptions`, `BdUpdateOptions`)
  - Mutation events (`MutationEvent`, `MutationType`)
- **Prompt Loading** (`prompts/`):
  - `loadPrompt()` - Load prompt files with custom overrides
  - `initPrompt()` - Initialize custom prompt from default
  - `hasCustomPrompt()` - Check for custom prompt existence

## Project Structure

```
cli/                       # CLI package (@herbcaudill/ralph)
  src/
    cli.ts                  # Commander program definition
    index.ts                # Entry point
    components/
      App.tsx               # Root component (router)
      IterationRunner.tsx   # Spawns Claude CLI, handles iterations
      InitRalph.tsx         # Initialization flow
      EventDisplay.tsx      # Renders event stream
      eventToBlocks.ts      # Parses events → display blocks
      ToolUse.tsx           # Renders individual tool calls
    lib/
      beadsClient.ts        # Unix socket RPC client for beads daemon
      MessageQueue.ts       # Async iterable message queue
      rel.ts                # Convert absolute → relative paths
  test/
    e2e/                    # E2E tests (skipped by default)
    fixtures/               # Test fixtures
  templates/                # Template files for ralph init
  bin/ralph.js              # Published executable

ui/                        # UI package (@herbcaudill/ralph-ui)
  server/                   # Express backend
    index.ts                # Server entry point with REST API + WebSocket
    main.ts                 # Development entry point
    RalphManager.ts         # Spawns and manages Ralph CLI process
    BdProxy.ts              # Proxy for beads CLI commands
    ThemeDiscovery.ts       # Discovers VS Code themes
    lib/
      theme/                # Theme parsing and mapping utilities
  src/                      # React frontend
    components/             # React components (chat, events, tasks, layout)
    store/                  # Zustand global state
    hooks/                  # Custom React hooks
    lib/                    # Utilities and theme management
    constants.ts            # Shared UI constants
    types.ts                # Shared UI types
  bin/ralph-ui.js           # Published executable
  public/                   # Static assets
  .storybook/               # Storybook configuration

shared/                    # Shared package (@herbcaudill/ralph-shared)
  src/
    events/                 # Normalized agent event types and guards
      types.ts              # AgentEvent, AgentMessageEvent, etc.
      guards.ts             # Type guard functions
    beads/                  # Beads domain types
      types.ts              # BdIssue, BdDependency, etc.
    prompts/                # Prompt loading utilities
      loadPrompt.ts         # Load prompt with custom override support
    index.ts                # Package exports
```

## Important Implementation Details

### Event Stream Parsing

The Claude CLI outputs newline-delimited JSON. Each line is a complete JSON object representing an event (assistant message, tool use, etc.). Ralph:

- Reads stdout line-by-line
- Tries to parse each line as JSON (ignoring incomplete lines)
- Appends valid events to state and log file
- Continues until stdout closes

### Relative Path Rendering

In the CLI UI, tool paths are rendered relative to the current workspace. Set `RALPH_CWD` to override the base path for relative rendering; otherwise it uses `process.cwd()`.

### Iteration Completion Logic

An iteration ends when:

1. The `claude` process exits (stdout closes AND process closes)
2. Exit code is checked - non-zero exits the entire program with error
3. If output contains `<promise>COMPLETE</promise>`, exit entire program successfully
4. Otherwise, start next iteration after 500ms delay

### Initialization Detection

On startup, `IterationRunner` reads the prompt from `.ralph/prompt.md` if it exists. If the file is missing, it automatically falls back to the bundled templates based on project setup (beads vs todo-based workflow). This allows Ralph to run without requiring `ralph init` first.

## Testing

Ralph has comprehensive test coverage across all three packages:

```bash
pnpm test:all          # Run all tests (CLI: 169, Server: 309, UI: 996+)
pnpm cli:test          # Run CLI tests only
pnpm server:test       # Run server tests only
pnpm ui:test           # Run UI tests only
```

### CLI Tests (`cli/test/`)

- Utility functions: `rel.ts`, `shortenTempPaths.ts`, `eventToBlocks.ts`
- React components (using `ink-testing-library`): `Header.tsx`, `ToolUse.tsx`, `StreamingText.tsx`
- E2E tests (skipped by default, require Claude CLI with API key)

### Server Tests (`server/`)

- Theme discovery and parsing
- Theme API endpoints
- WebSocket communication

### UI Tests (`ui/src/`)

- React component tests
- Store tests
- E2E tests with Playwright

### UI Conventions

- Components lead files; helper functions live in `ui/src/lib` (one function per file).
- Standalone subcomponents live in their own files next to the parent component.
- Shared types and constants live in `ui/src/types.ts` and `ui/src/constants.ts`.

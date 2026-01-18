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

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## User Input During Runtime

Ralph supports sending user messages to Claude while it's working:

- **Escape** - Opens a text input to send a message to Claude (only while running; press again to cancel)
- **Ctrl+T** - Opens a text input to add a todo item (only if todo.md exists)

User-injected messages appear in the output stream with a 📨 prefix and green color, so users know their message was received and processed.

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
   - Init mode: Set up `.ralph/` directory (`ralph init`)
   - Replay mode: Replay events from log (`ralph --replay [file]`)

2. **Iteration Runner** (`IterationRunner.tsx`) → Core orchestration:
   - Reads prompt from `.ralph/prompt.md` or falls back to bundled templates
   - Spawns `claude` CLI with `--output-format stream-json`
   - Parses streaming JSON events line-by-line
   - Appends events to `.ralph/events.log`
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
- `events.log` - JSON event stream for debugging/replay (auto-generated during runs)

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
# Build TypeScript to dist/
pnpm build

# Run in development (uses tsx, no build needed)
pnpm ralph

# Run tests
pnpm test:all          # Run all tests (E2E tests skipped by default)
pnpm test              # Run only unit tests
pnpm test:e2e          # Run E2E tests (requires Claude CLI with API key)
pnpm test:watch        # Run tests in watch mode
pnpm test:ui           # Open Vitest UI

# Format code with Prettier
pnpm format

# Run ralph locally during development
tsx src/index.ts [iterations]
tsx src/index.ts init
```

## Project Structure

```
src/
  cli.ts                    # Commander program definition
  index.ts                  # Entry point
  components/
    App.tsx                 # Root component (router)
    IterationRunner.tsx     # Spawns Claude CLI, handles iterations
    InitRalph.tsx           # Initialization flow
    EventDisplay.tsx        # Renders event stream
    eventToBlocks.ts        # Parses events → display blocks
    ToolUse.tsx            # Renders individual tool calls
    ReplayLog.tsx          # Replays events.log files
    Header.tsx             # Title banner
    StreamingText.tsx      # Streaming text display
  lib/
    beadsClient.ts         # Unix socket RPC client for beads daemon
    MessageQueue.ts        # Async iterable message queue for SDK streamInput
    rel.ts                 # Convert absolute → relative paths
    shortenTempPaths.ts    # Shorten temp paths in commands
test/
  e2e/
    ralph.test.ts          # E2E tests for ralph CLI (skipped by default)
  fixtures/                # Test fixtures for E2E tests
    empty/                 # Empty project (no .ralph)
    valid-setup/           # Complete .ralph setup
    incomplete-setup/      # Partial .ralph setup
    realistic-workflow/    # Realistic todo workflow
  helpers/
    runRalph.ts            # Helper to run ralph binary in tests
templates/                 # Template files for ralph init
bin/ralph.js              # Published executable
```

## Important Implementation Details

### Event Stream Parsing

The Claude CLI outputs newline-delimited JSON. Each line is a complete JSON object representing an event (assistant message, tool use, etc.). Ralph:

- Reads stdout line-by-line
- Tries to parse each line as JSON (ignoring incomplete lines)
- Appends valid events to state and log file
- Continues until stdout closes

### Iteration Completion Logic

An iteration ends when:

1. The `claude` process exits (stdout closes AND process closes)
2. Exit code is checked - non-zero exits the entire program with error
3. If output contains `<promise>COMPLETE</promise>`, exit entire program successfully
4. Otherwise, start next iteration after 500ms delay

### Initialization Detection

On startup, `IterationRunner` reads the prompt from `.ralph/prompt.md` if it exists. If the file is missing, it automatically falls back to the bundled templates based on project setup (beads vs todo-based workflow). This allows Ralph to run without requiring `ralph init` first.

## Testing

Ralph has comprehensive test coverage at multiple levels:

### Unit Tests (124+ tests)

**Utility Functions:**

- `rel.ts` - Path conversion (absolute to relative, temp path handling)
- `shortenTempPaths.ts` - Temp path shortening in command strings
- `eventToBlocks.ts` - JSON event parsing and transformation (23 test cases covering all tool types)

**React Components** (using `ink-testing-library`):

- `Header.tsx` - Title and version display
- `ToolUse.tsx` - Tool call rendering with various arguments
- `StreamingText.tsx` - Markdown formatting (bold, code)

**Integration:**

- `IterationRunner.tsx` - File checking logic with mocked fs

All unit tests run automatically with `pnpm test`.

### E2E Tests

End-to-end tests are in `test/e2e/` and use real test fixtures to verify the full CLI workflow.

**Test Fixtures:**

- `empty/` - Empty project with no `.ralph` directory
- `valid-setup/` - Complete `.ralph` setup ready to run
- `incomplete-setup/` - Partial `.ralph` (only prompt.md)
- `realistic-workflow/` - Realistic todo list with workflow prompt

**Running E2E Tests:**

E2E tests are skipped by default (marked with `describe.skip`) because they require:

1. A working `claude` CLI in PATH
2. Claude CLI configured with API key
3. Network access to Claude API

To run E2E tests:

```bash
# Ensure Claude CLI is installed and configured
claude --version

# Run E2E tests
pnpm test:e2e
```

The E2E tests verify:

- `ralph init` creates required files
- Missing file detection and error handling
- Multiple iteration execution
- COMPLETE promise detection
- Todo list updates across iterations

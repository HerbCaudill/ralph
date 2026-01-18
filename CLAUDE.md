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

## SDK Reference: Streaming Input for User Messages

The Claude Agent SDK supports two input modes:

### Single Message Mode (current ralph implementation)

```typescript
query({ prompt: "string prompt", options: {...} })
```

### Streaming Input Mode (for runtime user input)

```typescript
query({ prompt: asyncGenerator(), options: {...} })
```

To send user messages while Claude is working, use streaming input mode:

1. **Create an async generator** that yields `SDKUserMessage` objects
2. **Pass it to `query()`** as the `prompt` parameter
3. **Yield additional messages** from outside the generator when the user types

**SDKUserMessage structure:**

```typescript
type SDKUserMessage = {
  type: "user"
  message: MessageParam // { role: 'user', content: string | ContentBlock[] }
  parent_tool_use_id: string | null
  session_id: string
  isSynthetic?: boolean
  uuid?: UUID
}
```

**Example pattern:**

```typescript
// Create a message queue that can be pushed to from UI
const messageQueue: SDKUserMessage[] = []
let resolveWaiting: (() => void) | null = null

async function* messageGenerator(): AsyncGenerator<SDKUserMessage> {
  // Yield initial prompt
  yield {
    type: "user",
    message: { role: "user", content: initialPrompt },
    parent_tool_use_id: null,
    session_id: "", // SDK fills this in
  }

  // Wait for and yield additional messages
  while (true) {
    if (messageQueue.length > 0) {
      yield messageQueue.shift()!
    } else {
      await new Promise<void>(resolve => {
        resolveWaiting = resolve
      })
    }
  }
}

// Push message from UI handler
function sendUserMessage(text: string) {
  messageQueue.push({
    type: "user",
    message: { role: "user", content: text },
    parent_tool_use_id: null,
    session_id: "",
  })
  resolveWaiting?.()
}

// Start the query
for await (const message of query({ prompt: messageGenerator() })) {
  // Process messages
}
```

**Note:** The `Query.streamInput()` method exists but is marked as "used internally for multi-turn conversations." The documented approach is to pass an async generator to `query()` directly.

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
   - Checks for required file `.ralph/prompt.md` (`.ralph/todo.md` is optional)
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

- `prompt.md` - Instructions given to Claude each iteration (build commands, workflow) **(required)**
- `todo.md` - Task list in markdown checkbox format **(optional)**
- `events.log` - JSON event stream for debugging/replay (auto-generated during runs)

Templates are copied from `templates/` directory on `ralph init`.

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

On startup, `IterationRunner` checks for required files. If missing:

- In TTY environments: Shows interactive prompt to run `ralph init`
- In non-TTY environments: Shows message and exits
- User can press Y to run init, N/Esc to cancel

## Testing

Ralph has comprehensive test coverage at multiple levels:

### Unit Tests (124 tests)

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

All unit tests run automatically with `pnpm test` (124 tests).

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

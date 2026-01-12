## Project Overview

Ralph is an autonomous AI iteration engine that wraps the Claude CLI to run iterative development workflows. It spawns Claude CLI processes with a custom prompt, todo list, and progress log, captures streaming JSON output, displays it in a formatted terminal UI using Ink (React for CLIs), and orchestrates multiple iterations.

## Key Architecture

### Core Flow

1. **CLI Entry** (`cli.ts`) → Defines Commander.js program with two modes:
   - Main mode: Run N iterations (`ralph [iterations]`)
   - Init mode: Set up `.ralph/` directory (`ralph init`)
   - Replay mode: Replay events from log (`ralph --replay [file]`)

2. **Iteration Runner** (`IterationRunner.tsx`) → Core orchestration:
   - Checks for required files (`.ralph/prompt.md`, `todo.md`, `progress.md`)
   - Spawns `claude` CLI with `--output-format stream-json`
   - Parses streaming JSON events line-by-line
   - Appends events to `.ralph/events.log`
   - Detects `<promise>COMPLETE</promise>` to exit early
   - Recursively runs next iteration after completion

3. **Event Processing** (`eventToBlocks.ts`) → Transforms raw JSON events into display blocks:
   - Extracts tool calls (Read, Edit, Bash, Grep, Glob, TodoWrite, etc.)
   - Shortens file paths to relative paths
   - Formats tool arguments for display
   - Creates unique IDs for React keys

4. **Display Layer** (`EventDisplay.tsx`, `ToolUse.tsx`) → Renders events using Ink components

### Template System

Ralph initializes projects with template files in `.ralph/`:

- `prompt.md` - Instructions given to Claude each iteration (build commands, workflow)
- `todo.md` - Task list in markdown checkbox format
- `progress.md` - Auto-updated log of completed work
- `events.log` - JSON event stream for debugging/replay

Templates are copied from `templates/` directory on `ralph init`.

### The Contract with Claude CLI

Ralph expects Claude CLI to:

- Accept `@.ralph/prompt.md`, `@.ralph/todo.md`, `@.ralph/progress.md` as context files
- Output `--output-format stream-json` with `--include-partial-messages`
- Exit with code 0 on success
- Output `<promise>COMPLETE</promise>` when todo list is complete

Claude is instructed (via `prompt.md`) to:

- Check build/tests first, fix errors if found
- Select one high-priority task from todo.md
- Complete the task, update todo.md and progress.md
- Commit changes with git
- Output `<promise>COMPLETE</promise>` if todo list is empty

## Development Commands

```bash
# Build TypeScript to dist/
pnpm build

# Run in development (uses tsx, no build needed)
pnpm ralph

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
    rel.ts                 # Convert absolute → relative paths
    shortenTempPaths.ts    # Shorten temp paths in commands
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

## Testing Notes

This project doesn't currently have automated tests. When adding tests:

- Use Vitest for unit tests
- Test event parsing logic in `eventToBlocks.ts`
- Test path manipulation in `lib/rel.ts` and `lib/shortenTempPaths.ts`
- Consider snapshot tests for React components using `ink-testing-library`

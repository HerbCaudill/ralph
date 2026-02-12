# @herbcaudill/ralph

Autonomous AI session engine that wraps the Claude CLI to run iterative development workflows. Spawns Claude CLI processes with a custom prompt, captures streaming JSON output, displays it in a formatted terminal UI using Ink, and orchestrates multiple sessions.

## Install

```bash
npm install -g @herbcaudill/ralph
```

## Quick start

```bash
# Initialize ralph in your project
ralph init

# Run autonomous sessions
ralph
```

## Usage

```
ralph [sessions]     Run N autonomous sessions (default: auto-calculated)
ralph init           Set up .ralph/ directory with workflow config
ralph --replay       Replay events from the most recent log file
ralph --replay <f>   Replay events from a specific file
```

### Options

| Flag                   | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `--watch`, `-w`        | After completing all tasks, watch for new beads issues |
| `--json`, `-j`         | Output events as JSON (machine-readable mode)          |
| `--agent <name>`, `-a` | Agent to use: `claude` (default) or `codex`            |
| `--replay [file]`      | Replay events from a log file                          |

### Session count

By default, Ralph runs `ceil(openIssues * 1.2)` sessions, bounded between 10 and 100. Pass a number to override: `ralph 5`.

## How it works

1. Ralph combines a core prompt with your repo's `.ralph/workflow.prompt.md` to build the session instructions
2. Spawns the agent CLI with `--output-format stream-json`
3. The agent checks build/tests, finds available issues via `bd ready`, claims one, completes it, and closes it
4. Events are streamed to the terminal UI and logged to `.ralph/events-*.jsonl`
5. Sessions repeat until all issues are done or the session limit is reached

## Runtime controls

| Key      | Action                      |
| -------- | --------------------------- |
| `Escape` | Send a message to the agent |
| `Ctrl+T` | Add a todo item             |
| `Ctrl+S` | Stop after current session  |
| `Ctrl+P` | Pause/resume                |

### JSON mode stdin commands

```json
{ "type": "message", "text": "your message" }
{ "type": "stop" }
{ "type": "pause" }
{ "type": "resume" }
```

## Configuration

After `ralph init`, customize `.ralph/workflow.prompt.md` with your repo's build commands, test commands, and task prioritization rules.

## Template system

- **Core prompt** (bundled) - Session lifecycle, task assignment, output tokens
- **Workflow** (`.ralph/workflow.prompt.md`) - Repo-specific build/test commands and workflow rules

## Environment variables

| Variable            | Description                                                          |
| ------------------- | -------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Required for the Claude agent                                        |
| `OPENAI_API_KEY`    | Optional for the Codex agent                                         |
| `RALPH_DEBUG`       | Enable debug logging (`1`, or namespace like `messagequeue,session`) |
| `RALPH_CWD`         | Override base path for relative path rendering                       |

## Debug logging

```bash
RALPH_DEBUG=1 ralph                    # all debug output
RALPH_DEBUG=messagequeue ralph         # specific namespace
RALPH_DEBUG=messagequeue,session ralph # multiple namespaces
```

# Ralph

Autonomous AI iteration engine for Claude CLI. Ralph spawns Claude CLI processes with custom prompts, captures streaming output, and orchestrates multiple iterations to complete tasks autonomously.

## Packages

This monorepo contains three packages:

| Package                                | Description                            |
| -------------------------------------- | -------------------------------------- |
| [`@herbcaudill/ralph`](cli/)           | CLI tool for terminal-based iterations |
| [`@herbcaudill/ralph-ui`](ui/)         | Web UI with real-time event streaming  |
| [`@herbcaudill/ralph-shared`](shared/) | Shared types and utilities             |

## Installation

```bash
# CLI only
npm install -g @herbcaudill/ralph

# Web UI
npm install -g @herbcaudill/ralph-ui
```

## Quick start

### CLI

```bash
# Initialize Ralph in your project
ralph init

# Run iterations (default: 10)
ralph

# Run specific number of iterations
ralph 5

# Watch mode: poll for new tasks after completion
ralph --watch
```

### Web UI

```bash
# Start the UI server
ralph-ui start --open
```

The UI provides real-time monitoring, task management, and support for multiple AI agents (Claude, Codex).

## How it works

1. Ralph combines a core prompt with your project's `.ralph/workflow.md`
2. Spawns Claude CLI with `--output-format stream-json`
3. Claude checks for errors, finds available tasks via `bd ready`, and works through them
4. Outputs `<start_task>` and `<end_task>` markers as it works
5. Exits when no tasks remain (`<promise>COMPLETE</promise>`)

Ralph integrates with [beads](https://github.com/HerbCaudill/beads) for issue tracking, but works without it too.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test:all

# Start UI in development
pnpm dev

# Format code
pnpm format
```

## Environment variables

| Variable            | Description                              | Required       |
| ------------------- | ---------------------------------------- | -------------- |
| `ANTHROPIC_API_KEY` | API key for Claude                       | Yes for Claude |
| `OPENAI_API_KEY`    | API key for Codex                        | Optional       |
| `HOST`              | Server bind address (default: 127.0.0.1) | No             |
| `PORT`              | Server port (default: 4242)              | No             |

## License

MIT

## Author

Herb Caudill

# Ralph UI

Web UI for Ralph - A React frontend and server for the autonomous AI iteration engine.

## Overview

Ralph UI provides a visual interface for managing and monitoring autonomous AI agents as they iterate on tasks. It features real-time event streaming, task management, and support for multiple AI coding agents.

## Features

- **Real-time Agent Monitoring** - Watch AI agents work through tasks with live event streaming
- **Multi-Agent Support** - Choose between Claude and Codex agents
- **Task Management** - Create, track, and organize tasks with dependencies
- **Event Log Viewer** - Detailed view of agent actions, tool uses, and outputs
- **Dark Mode** - Customizable themes with VSCode color scheme support
- **WebSocket Integration** - Live updates without polling

## Installation

```bash
npm install @herbcaudill/ralph-ui
```

## Quick Start

### Starting the UI Server

```bash
# Start the server
ralph-ui start

# Start and open browser
ralph-ui start --open

# Start on custom port
ralph-ui start --port 8080

# Stop the server
ralph-ui stop

# Check server status
ralph-ui status
```

The UI will be available at `http://127.0.0.1:4242` by default.

## Multi-Agent Support

Ralph UI supports multiple AI coding agents through an adapter architecture. Each agent can be used interchangeably through a common interface.

### Supported Agents

#### Claude (Default)

- Provider: Anthropic
- SDK: `@anthropic-ai/claude-agent-sdk`
- Features: Streaming, tools, system prompts
- Setup: Set `ANTHROPIC_API_KEY` environment variable

#### Codex

- Provider: OpenAI
- SDK: `@openai/codex-sdk`
- Features: Streaming, tools, system prompts
- Setup: `OPENAI_API_KEY` is optional if you're logged into the local codex CLI

### Using Different Agents

The agent is selected when starting Ralph iterations. By default, Claude is used unless explicitly specified:

```bash
# Use Claude (default)
ralph

# Use Codex
ralph --agent codex
```

When using the programmatic API:

```typescript
import { RalphManager } from "@herbcaudill/ralph-ui"

// Use Claude (default)
const ralphClaude = new RalphManager()

// Use Codex
const ralphCodex = new RalphManager({ agent: "codex" })

await ralphCodex.start()
```

### How It Works

The multi-agent architecture uses the **Adapter Pattern** to normalize different agent APIs:

1. **AgentAdapter** - Base class that all agents implement
2. **Event Normalization** - Each adapter translates native events to a common format
3. **AgentRegistry** - Discovers and instantiates available adapters

This design allows:

- Adding new agents without changing UI code
- Switching agents at runtime
- Testing with mock agents
- Consistent event handling across all agents

## Development

### Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm

### Setup

```bash
# Install dependencies
pnpm install

# Run development servers
pnpm dev          # Frontend (Vite)
pnpm dev:server   # Backend (Express)
pnpm dev:headless # Frontend without opening a browser window
```

### Testing

```bash
# Run all tests
pnpm test:all

# Run unit tests
pnpm test

# Run unit tests in watch mode
pnpm test:watch

# Run Playwright e2e tests
pnpm test:pw

# Playwright uses scripts/dev.js to start the server + UI with dynamic ports.
# It waits for the UI to be ready before running tests.
# Server output is written to ui/test-results/playwright-dev.log.

# Run Playwright with UI
pnpm test:pw:ui
```

### Building

```bash
# Build for production
pnpm build

# Type checking
pnpm typecheck

# Format code
pnpm format
```

## Architecture

### Frontend

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **WebSocket** - Real-time updates

### Backend

- **Express** - HTTP server
- **WebSocket** - Real-time communication
- **Agent Adapters** - Multi-agent support
- **Event Log Store** - Persistent event storage

### Key Directories

```
├── src/               # React frontend
│   ├── components/    # UI components
│   ├── hooks/         # React hooks
│   ├── lib/           # Utilities
│   ├── constants.ts   # Shared UI constants
│   ├── types.ts       # Shared UI types
│   └── store/         # Zustand state
├── server/            # Node.js backend
│   ├── AgentAdapter.ts      # Agent abstraction
│   ├── AdapterRegistry.ts   # Agent discovery
│   ├── ClaudeAdapter.ts     # Claude implementation
│   ├── CodexAdapter.ts      # Codex implementation
│   ├── RalphManager.ts      # Ralph CLI management
│   └── IterationRunner.ts   # Iteration execution
├── bin/               # CLI scripts
└── e2e/               # Playwright tests
```

## Environment Variables

| Variable            | Description              | Default                                        |
| ------------------- | ------------------------ | ---------------------------------------------- |
| `ANTHROPIC_API_KEY` | API key for Claude agent | Required for Claude                            |
| `OPENAI_API_KEY`    | API key for Codex agent  | Optional (uses local codex CLI auth if absent) |
| `HOST`              | Server bind address      | 127.0.0.1                                      |
| `PORT`              | Server port              | 4242                                           |

## API

### RalphManager

The `RalphManager` class manages Ralph CLI processes with multi-agent support:

```typescript
import { RalphManager } from "@herbcaudill/ralph-ui"

const manager = new RalphManager({
  agent: "codex", // Agent to use (default: "claude")
  cwd: "/path/to/project",
  watch: true, // Enable watch mode
})

// Listen for events
manager.on("event", event => {
  console.log("Ralph event:", event)
})

// Start Ralph
await manager.start(10) // Run 10 iterations

// Send messages
manager.send("Continue with the next task")

// Stop Ralph
await manager.stop()
```

### AgentAdapter

Create custom agent adapters by extending `AgentAdapter`:

```typescript
import { AgentAdapter, AgentInfo, AgentStartOptions } from "@herbcaudill/ralph-ui"

class MyCustomAdapter extends AgentAdapter {
  getInfo(): AgentInfo {
    return {
      id: "custom",
      name: "My Custom Agent",
      features: {
        streaming: true,
        tools: true,
        pauseResume: false,
        systemPrompt: true,
      },
    }
  }

  async isAvailable(): Promise<boolean> {
    // Check if agent is available
    return true
  }

  async start(options?: AgentStartOptions): Promise<void> {
    // Start the agent
    this.setStatus("running")
  }

  send(message: AgentMessage): void {
    // Send message to agent
  }

  async stop(force?: boolean): Promise<void> {
    // Stop the agent
    this.setStatus("stopped")
  }
}
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `pnpm test:all` to ensure all tests pass
6. Submit a pull request

## License

MIT

## Author

Herb Caudill

## Links

- [GitHub Repository](https://github.com/HerbCaudill/ralph)
- [npm Package](https://www.npmjs.com/package/@herbcaudill/ralph-ui)

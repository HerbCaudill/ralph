```
█▀█ ▄▀█ █   █▀█ █ █
█▀▄ █▀█ █▄▄ █▀▀ █▀█
```

Autonomous AI iteration engine for Claude CLI. Ralph runs Claude in a loop to systematically work through your codebase's task list, enabling Claude to tackle work items iteratively.

https://github.com/user-attachments/assets/e8d89a33-8db5-4d72-9c97-927558f92516

## Overview

Ralph spawns individual Claude CLI sessions that:

1. Check project health (build, tests)
2. Select and work on the highest-priority task
3. Validate changes with tests
4. Commit changes
5. Repeat

## Installation

```bash
pnpm add -D @herbcaudill/ralph
```

Or use directly with npx:

```bash
npx @herbcaudill/ralph
```

## Quick start

1. **Initialize ralph in your project:**

   ```bash
   npx @herbcaudill/ralph init
   ```

   This creates a `.ralph/` directory with template files:
   - `prompt.md` - Instructions for Claude during each iteration
   - `todo.md` - Your task list (optional if using bd)
   - `events.log` - Event log (auto-generated during runs)

2. **Customize the workflow:**

   Edit `.ralph/prompt.md` to match your project's workflow (build commands, test commands, etc.).

3. **Add tasks:**

   You can manage tasks using either a markdown file or [beads](https://github.com/steveyegge/beads), a lightweight issue tracker.

   **Option A: Using `.ralph/todo.md`**

   ```markdown
   ### To do

   - [ ] Add user authentication
   - [ ] Fix login form validation
   - [ ] Write tests for auth flow

   ---

   ### Done
   ```

   **Option B: Using beads (recommended)**

   ```bash
   # Install bd
   brew install herbcaudill/tap/bd

   # Initialize in your project
   bd init

   # Create issues
   bd create "Add user authentication"
   bd create "Fix login form validation"
   bd create "Write tests for auth flow"

   # View ready work
   bd ready
   ```

4. **Run ralph:**

   ```bash
   npx ralph          # Run 50 iterations (default)
   npx ralph 5        # Run 5 iterations
   npx ralph --watch  # Run and watch for new issues
   ```

## Commands

| Command         | Description                                |
| --------------- | ------------------------------------------ |
| `ralph`         | Run 50 iterations (default)                |
| `ralph <n>`     | Run specified number of iterations         |
| `ralph init`    | Initialize .ralph directory with templates |
| `ralph --watch` | Watch for new issues after completion      |
| `ralph --help`  | Show help                                  |

## Watch mode

Watch mode (`--watch`) keeps ralph running after completing all tasks, waiting for new issues to be added:

```bash
npx ralph --watch
```

When ralph finishes all available work and Claude outputs the completion signal, instead of exiting, it enters a waiting state. When you add a new issue via `bd create` or `bd q`, ralph automatically detects it and starts a new iteration to work on it.

This enables a "continuous integration" style workflow:

1. Start ralph in watch mode: `npx ralph --watch`
2. Add tasks as you think of them: `bd q "Fix header alignment"`
3. Ralph automatically picks up and works on new tasks
4. Keep adding tasks while ralph works

Watch mode requires **bd** (beads) for issue tracking—it watches for mutations to the beads database.

## Configuration

**`.ralph/prompt.md`**

Instructions for Claude's workflow. Customize this for your project:

- Build/typecheck commands
- Test commands
- Project-specific conventions
- Commit message style

### Customizing the prompt

The default prompt ([for beads](./templates/prompt-beads.md) or [for TODO.md](./templates/prompt.md)) works for my , but you should customize it for your project. Replace with your actual build/test commands (e.g., `pnpm build`, `cargo test`, `pytest`, etc.).

## How it works

Ralph is a thin wrapper around the Claude CLI that:

1. **Spawns Claude CLI** with your project context (prompt, todo, progress files)
2. **Captures output** as streaming JSON events
3. **Processes events** to display tool usage (Read, Edit, Bash, etc.) in a readable format
4. **Logs everything** to `events.log` for debugging
5. **Detects completion** when Claude outputs `<promise>COMPLETE</promise>`
6. **Recursively runs** next iteration until count reached or todo list complete

## Requirements

- **Claude CLI** must be installed and configured
- **Node.js** 18 or higher
- Git repository (for commits)

Install Claude CLI:

```bash
# macOS/Linux
curl https://claude.com/cli | sh

# Or with Homebrew
brew install anthropics/tap/claude
```

Configure Claude CLI:

```bash
claude auth
```

## Tips

- **Start with small iteration counts** (3-5) to verify the workflow before running longer sessions
- **Customize prompt.md** for your project's specific needs (build commands, test frameworks, etc.)
- **Break down complex tasks** into smaller subtasks in todo.md
- **Let Claude prioritize** by not ordering tasks strictly - Claude will choose what makes sense

## License

MIT

## Author

Herb Caudill

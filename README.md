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

   You can manage tasks using either a markdown file or **bd** (beads), a lightweight issue tracker.

   **Option A: Using `.ralph/todo.md`**

   ```markdown
   ### To do

   - [ ] Add user authentication
   - [ ] Fix login form validation
   - [ ] Write tests for auth flow

   ---

   ### Done
   ```

   **Option B: Using bd (recommended)**

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

## Using bd for Issue Tracking

Ralph works great with **bd** (beads), a lightweight issue tracker with first-class dependency support.

### Setup

```bash
# Install bd
brew install herbcaudill/tap/bd

# Initialize in your project
bd init
```

### Common bd Commands

```bash
# Create issues
bd create "Add user authentication"
bd q "Quick issue capture"              # Creates issue, outputs only ID

# View issues
bd ready                                 # Show issues ready to work on
bd show <id>                             # View issue details
bd list                                  # List all issues

# Update issues
bd update <id> --status=in_progress      # Mark as in progress
bd close <id>                            # Close an issue

# Dependencies
bd dep <id> --on <other-id>              # Add dependency
bd graph                                 # View dependency graph

# Sync with git
bd sync                                  # Sync issues with remote
```

### Example Workflow with bd

```bash
# Create a few issues
bd create "Implement login form"
bd create "Add form validation"
bd create "Write login tests"

# Add dependencies
bd dep r-002 --on r-001                  # Validation depends on login form
bd dep r-003 --on r-002                  # Tests depend on validation

# See what's ready to work on
bd ready

# Start working on an issue
bd update r-001 --status=in_progress

# Run ralph to work through issues
npx ralph --watch                        # Runs and watches for new issues

# Or run a fixed number of iterations
npx ralph 5
```

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

### Template files

**`.ralph/prompt.md`**

Instructions for Claude's workflow. Customize this for your project:

- Build/typecheck commands
- Test commands
- Project-specific conventions
- Commit message style

**`.ralph/todo.md`**

Your task list with priority and completion status. Tasks can be:

- Simple one-liners: `- [ ] Fix header alignment`
- Detailed descriptions with acceptance criteria
- Broken down into subtasks

**`.ralph/events.log`**

Machine-readable log of all Claude interactions (JSON). Use for debugging.

### Customizing the prompt

The default prompt template checks for build errors and tests, but you should customize it for your project:

```markdown
Before doing anything, run `npm run typecheck` and `npm test`.

If there are errors: YOUR ONLY TASK IS TO FIX THEM.

If no errors, work on the highest-priority task from @.ralph/todo.md.
```

Replace with your actual build/test commands (e.g., `pnpm build`, `cargo test`, `pytest`, etc.).

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

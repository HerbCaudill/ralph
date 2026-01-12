# Ralph

Autonomous AI iteration engine for Claude CLI. Ralph runs Claude in a loop to systematically work through your codebase's task list, enabling Claude to tackle work items iteratively.

## Overview

Ralph spawns multiple Claude CLI sessions that:

1. Check project health (build, tests)
2. Select and work on the highest-priority task
3. Validate changes with tests
4. Document progress
5. Commit changes
6. Repeat

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
- `todo.md` - Your task list
- `progress.md` - Progress log (auto-updated)
- `events.log` - Event log (auto-generated)

2. **Customize the workflow:**

Edit `.ralph/prompt.md` to match your project's workflow (build commands, test commands, etc.).

3. **Add tasks:**

Edit `.ralph/todo.md` and add tasks for Claude to work on:

```markdown
### To do

- [ ] Add user authentication
- [ ] Fix login form validation
- [ ] Write tests for auth flow

---

### Done
```

4. **Run ralph:**

```bash
npx ralph          # Run 10 iterations (default)
npx ralph 5        # Run 5 iterations
```

## Commands

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `ralph`                 | Run 10 iterations (default)                |
| `ralph <n>`             | Run specified number of iterations         |
| `ralph init`            | Initialize .ralph directory with templates |
| `ralph --replay`        | Replay events from `.ralph/events.log`     |
| `ralph --replay <file>` | Replay events from custom log file         |
| `ralph --help`          | Show help                                  |

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

**`.ralph/progress.md`**

Auto-updated log of completed work. Each entry includes:

- What was changed
- Why it was changed
- Commit information

**`.ralph/events.log`**

Machine-readable log of all Claude interactions (JSON). Use for debugging or replay.

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
4. **Logs everything** to `events.log` for replay and debugging
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
- **Review progress.md** between runs to understand what changed
- **Customize prompt.md** for your project's specific needs (build commands, test frameworks, etc.)
- **Break down complex tasks** into smaller subtasks in todo.md
- **Let Claude prioritize** by not ordering tasks strictly - Claude will choose what makes sense

## License

MIT

## Author

Herb Caudill

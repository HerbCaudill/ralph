# Project Workflow

## Build and test

Run this command to check for errors:

```bash
pnpm test:all
```

## Task selection

When choosing which task to work on:

- Finish in-progress tasks first
- Bugs take priority over features
- Higher priority (lower number) takes precedence
- Otherwise use your judgment

## Breaking down tasks

If a task will take more than a few minutes of focused work, break it into subtasks:

- Create child issues under the parent with `--parent={id}`
- Apply the parent's priority to all children
- End your turn after creating subtasks (you'll pick one up next iteration)

## Wrap-up steps

Before completing a task:

1. Run `pnpm format` to format code
2. Run `pnpm test:all && pnpm build` to verify everything works
3. Add tests where applicable
4. Update CLAUDE.md or README.md with relevant changes
5. Commit and push your changes (only files you modified)

## When to delegate

Consider delegating to subagents for:

- **Test writing**: When adding tests for existing code, use the make-tests agent
- **Documentation**: When documenting APIs or adding README sections, use the write-docs agent

These run on faster/cheaper models and let you focus on the core implementation work.

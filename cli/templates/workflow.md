# Project Workflow

## Build and test

Use the **run-tests** agent to check for errors. The test command for this project is:

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
- End your turn after creating subtasks (you'll pick one up next session)

## Wrap-up steps

Before completing a task:

1. Run `pnpm format` to format code
2. Use the **run-tests** agent to verify everything works
3. Use the **make-tests** agent to add tests where applicable
4. Use the **write-docs** agent to update CLAUDE.md or README.md with relevant changes
5. Commit and push your changes (only files you modified)

## When to delegate

Delegate to subagents for:

- **Running tests**: Use the run-tests agent to check builds and get summarized failure info
- **Writing tests**: Use the make-tests agent to generate tests for new or existing code
- **Documentation**: Use the write-docs agent to document APIs or update README sections

These run on faster/cheaper models and keep verbose output out of your context.

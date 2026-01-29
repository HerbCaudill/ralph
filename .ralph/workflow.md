# Project Workflow

Output your working directory before beginning.

## Build and test

Use the **run-tests** agent to check for errors, using `pnpm test:all`.

## Task selection

When choosing which task to work on:

- Finish your in-progress tasks first
- Bugs take priority over features
- Higher priority (lower number) takes precedence
- Otherwise use your judgment

## Working on tasks

When debugging, you can use the

## Breaking down tasks

If a task will take more than a few minutes of focused work, break it into subtasks:

- Create child issues under the parent with `--parent={id}`
- Apply the parent's priority to all children
- End your turn after creating subtasks (you'll pick one up next session)

## Wrap-up steps

Before completing a task:

1. Use the **run-tests** agent to verify everything works, this time with `pnpm test:all --changed`.
2. Run `pnpm format` to format code
3. Use the **make-tests** agent to add tests where applicable
4. Use the **write-docs** agent to update CLAUDE.md or README.md with relevant changes
5. Commit and push your changes (only files you modified)

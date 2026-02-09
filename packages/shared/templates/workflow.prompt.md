# Project Workflow

## Build and test

Use the **run-tests** agent to check for errors, using `pnpm test`.

## Task selection

When choosing which task to work on:

- Finish your in-progress tasks first
- Bugs take priority over features
- Higher priority (lower number) takes precedence
- Otherwise use your judgment

## Breaking down tasks

There are two kinds of parent-child relationships in beads:

### Epics (separate sessions)

If a task is large enough to warrant multiple independent sessions, convert it to an epic:

- `bd update {id} --type=epic`
- Create child tasks with `--parent={id}` — each gets its own random ID
- Apply the parent's priority to all children
- End your turn after creating subtasks (you'll pick one up next session)

### Subtasks (same session)

If you just need to track steps within a single task, use subtasks:

- Create subtasks with `--parent={id}` on a non-epic parent — IDs are `{parentId}.1`, `{parentId}.2`, etc.
- Work through all subtasks in the current session
- Close each subtask as you complete it, then close the parent

## Wrap-up steps

Before completing a task:

1. Use the **run-tests** agent to verify everything works, this time with `pnpm test --changed`.
2. Run `pnpm format` to format code
3. Use the **make-tests** agent to add tests where applicable
4. Use the **write-docs** agent to update CLAUDE.md or README.md with relevant changes
5. Commit and push your changes (only files you modified)

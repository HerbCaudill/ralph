# Project workflow

## Task selection

When choosing which task to work on:

- Finish in-progress tasks assigned to you first
- Bugs take priority over features
- Higher priority (lower number) takes precedence
- Otherwise use your judgment

## Working on a task

- **Break down complex tasks**  
  If a task is too complex to solve in one session, break it into subtasks. Create child issues under the parent with `--parent={id}`. Apply the parent's priority to all children. End your turn after creating subtasks (you'll pick one up next session).

- **Write tests first**  
  Use the `Test-Driven Development (TDD)` skill. When fixing a bug, before doing anything else, start by writing a test that reproduces the bug. Then fix the bug and prove it with a passing test.

- **Report unrelated issues**  
  While you're working, if you notice unrelated bugs or other issues, use `bd create` to file issues for another agent to work on.

## Wrap-up steps

Before completing a task:

1. Run `pnpm test:all` again to verify everything works.
2. Use the **write-docs** agent to update CLAUDE.md or README.md with relevant changes.
3. Run `pnpm format` to format code.
4. Commit and push your changes. If you come across unrelated changes, probably the user or another agent is working in the codebase at the same time. Be careful just to commit the changes you made.

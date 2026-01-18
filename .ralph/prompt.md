Before doing anything, run `pnpm build && pnpm test:all`.

If there are build errors or test failures, fix them until the build succeeds and all tests pass. Commit your changes and end your turn.

Otherwise, run `bd ready` to list unblocked issues.

If there are no open issues, immediately output <promise>COMPLETE</promise> and exit.

Otherwise, find the highest-priority issue to work on, and work only on that task. Only work on a single issue in a single turn. If the issue you choose is complex, your task is to break it into sub-issues and then end your turn.

Mark the issue as in progress with `bd update <id> --status=in_progress`

When you complete a task:

- Where applicable, add tests to validate your changes and confirm that they pass
- Update CLAUDE.md with any relevant changes
- Run `pnpm build && pnpm test:all`
- Run `pnpm format`
- Close the issue: `bd close <id>`
- Commit and push your work
- Output "🚀"
- End your turn

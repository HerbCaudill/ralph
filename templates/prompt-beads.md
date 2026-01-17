Before doing anything, run `pnpm build && pnpm test:all`.

If there are build errors or test failures:

- File an issue describing the errors.
- End your turn.

If there are no errors:

- Run `bd ready` to list unblocked issues.

If there are no open issues:

- Immediately output <promise>COMPLETE</promise>
- End your turn

If there are open issues:

- Find the highest-priority issue to work on. Use your best judgement.
- Output `✨ <task name>`.
- Mark the issue as in progress with `bd update <id> --status=in_progress`
- Work only on that task. Only work on a single issue in a single turn. If the issue you choose is complex, your task is to break it into sub-issues and then end your turn.
- While you're working, if you notice something else that needs to be done - follow-up tasks, other things that don't seem to be working right - open new issues.
- Where applicable, add tests to validate your changes and confirm that they pass.
- Update AGENTS.md with any relevant changes.

When you complete a task:

- Run `ppnpm format`.
- Run `pnpm build && pnpm test:all`.
- Commit and push your work.
- Record a summary of the changes you made as a comment in the issue with `bd comments <id> --add "...markdown summary of changes"`.
- Close the issue: `bd close <id>`.
- Output `✅ <task name>`.
- End your turn.

### Commit message format

```
<concise summary of changes> (<issue id>)
<more detailed summary of changes>
```

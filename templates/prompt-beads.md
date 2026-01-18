### Step 1: Check for errors

Run `pnpm test:all`. If there are build errors or test failures:

- Create a P1 issue documenting them.
- This is your only task.
- Proceed to Step 4

### Step 2: Check for open issues

Run `bd ready` to list unblocked issues.

If there are issues ready to be worked on, proceed to Step 3.

If there are none:

- Immediately output <promise>COMPLETE</promise>.
- End your turn.

### Step 3: Select a task

Select the highest-priority issue to work on. Use your best judgement.

### Step 4: Work on a single task

- Output `✨ Starting -> <task name>`.
- Mark the issue as in progress with `bd update <id> --status=in_progress`
- Work only on that task. Only work on a single issue in a single turn.
- If the issue you choose is complex enough that it will take you more than a minute or two, your task is to break it into sub-issues and then end your turn.
- While you're working, if you notice something else that needs to be done - follow-up tasks, other things that don't seem to be working right - open new issues.
- Where applicable, add tests to validate your changes and confirm that they pass.
- Update CLAUDE.md and/or README.md with any relevant changes.

### Step 5: Wrap up

When you complete a task:

- Run `ppnpm format`.
- Run `pnpm test:all && pnpm build`.
- Commit and push your work.
- Record a summary of the changes you made as a comment in the issue with `bd comments add <id> "...markdown summary of changes"`.
- Close the issue: `bd close <id>`.
- Output `✅ Completed -> <task name>`.
- End your turn.

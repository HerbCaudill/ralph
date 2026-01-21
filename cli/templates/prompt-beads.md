### Step 1: Check for errors

Run `pnpm test:all`. If there are build errors or test failures:

- Create a P1 issue documenting them.
- This is your only task.
- Proceed to Step 4

### Step 2: Check for open issues

Run `bd ready` to list unblocked issues.

If there are issues ready to be worked on, proceed to Step 3.

If there are none:

- Immediately output `<promise>COMPLETE</promise>`.
- End your turn.

### Step 3: Select a task

Select the highest-priority issue to work on. Finish in-progress tasks first. Bugs take priority. Otherwise use your best judgement.

**Skip tasks assigned to other agents.** When reviewing available work with `bd ready`, check the assignee field. If a task is assigned to a different agent (not you), skip it and look for another task.

### Step 4: Work on a single task

- Output `<start_task>{id}</start_task>`
- Mark the issue as in progress and assign it to yourself with `bd update {id} --status=in_progress --assignee={agentName}`
- Work only on that task. Only work on a single issue in a single turn.
- If the issue you choose is complex enough that it will take you more than a minute or two, your task is to break it into sub-issues and then end your turn.
- While you're working, if you notice something else that needs to be done - follow-up tasks, other things that don't seem to be working right - open new issues.
- Where applicable, add tests to validate your changes and confirm that they pass.
- Update `CLAUDE.md` and/or `README.md` with any relevant changes.

### Step 5: Wrap up

When you complete a task:

- Run `ppnpm format`.
- Run `pnpm test:all && pnpm build`.
- Commit and push your work. Only commit the files you've changed.
- Record a summary of the changes you made as a comment in the issue with `bd comments add {id} "...markdown summary of changes"`.
- Close the issue: `bd close {id}`.
- Output `<end_task>{id}</end_task>`
- End your turn.

---

# Beads reference

## Core Rules

- Use `bd create` for issues, TodoWrite for simple single-session execution

## Essential Commands

### Finding Work

- `bd ready` - Show issues ready to work (no blockers)
- `bd list --status=open` - All open issues
- `bd list --status=in_progress` - Your unfinished work
- `bd show {id}` - Detailed issue view with dependencies

### Creating & Updating

- `bd create --title="..." --type=task|bug|epic --priority=2` - New issue
  - Priority: 0-4 or P0-P4 (0=critical, 2=medium, 4=backlog). NOT "high"/"medium"/"low"
- `bd update {id} --status=in_progress` - Claim work
- `bd update {id} --assignee=username` - Assign to someone
- `bd close {id}` - Mark complete
- `bd close {id1} {id2} ...` - Close multiple issues at once (more efficient)
- `bd close {id} --reason="explanation"` - Close with reason
- **Tip**: When creating multiple issues/tasks/epics, use parallel subagents for efficiency

### Dependencies & Blocking

- `bd dep add {issue} {depends-on}` - Add dependency (issue depends on depends-on)
- `bd blocked` - Show all blocked issues
- `bd show {id}` - See what's blocking/blocked by this issue

### Sync & Collaboration

- Daemon handles beads sync automatically (auto-commit + auto-push + auto-pull enabled)
- `bd sync --status` - Check sync status

### Project Health

- `bd stats` - Project statistics (open/closed/blocked counts)
- `bd doctor` - Check for issues (sync problems, missing hooks)

## Common Workflows

**Starting work:**

```bash
bd ready           # Find available work
bd show {id}       # Review issue details (check assignee - skip if assigned to another agent)
bd update {id} --status=in_progress --assignee={agentName}  # Claim it and assign to yourself
```

**Completing work:**

```bash
bd close {id1} {id2} ...    # Close all completed issues at once
git push                    # Push to remote (beads auto-synced by daemon)
```

**Creating dependent work:**

```bash
# Run bd create commands in parallel (use subagents for many items)
bd create --title="Implement feature X" --type=feature
bd create --title="Write tests for X" --type=task
bd dep add beads-yyy beads-xxx  # Tests depend on Feature (Feature blocks tests)
```

# Ralph session protocol

You are running as an autonomous session agent. Follow this protocol exactly.

## Session lifecycle

### Find available work

Run `bd ready --assignee {agentName} --assignee ""` to list issues that are either:

- Unassigned, or
- Assigned to you

If no issues are ready, output `<promise>COMPLETE</promise>` and end your session.

### Claim and work on one task

Select the highest-priority issue. Finish in-progress tasks first. Bugs take priority.

- Output `<start_task>{id}</start_task>`
- Assign the issue to yourself: `bd update {id} --status=in_progress --assignee={agentName}`
- Work only on this single task.
- If the task has subtasks (IDs like `{id}.1`, `{id}.2`), complete all of them in this session.
- If the task is too complex for one session, convert to an epic and break into child tasks (see workflow).

### Complete the task

When finished:

- Run wrap-up steps (see workflow instructions)
- Close the issue: `bd close {id}`
- Record a summary: `bd comments add {id} "..." --author=Ralph`
- Output `<end_task>{id}</end_task>`
- End your session.

---

## Beads quick reference

```bash
bd ready # Show issues ready to work
bd show {id} # Detailed issue view
bd update {id} --status=in_progress --assignee={agentName}
bd close {id} # Mark complete
bd create --title="..." --type=task|bug|epic --priority=2
bd comments add {id} "..." --author=Ralph # Add comment
```

Priority: 0-4 (0=critical, 2=medium, 4=backlog). Use P0-P4 format.

---

# Workflow instructions

{WORKFLOW}

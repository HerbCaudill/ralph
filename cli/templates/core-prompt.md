# Ralph Iteration Protocol

You are running as an autonomous iteration agent. Follow this protocol exactly.

## Iteration lifecycle

### Step 1: Check for errors

Run the project's build/test command (defined in your workflow instructions below).

- If errors exist: create a P1 bug issue documenting them. Skip to Step 4.
- If no errors: proceed to Step 2.

### Step 2: Find available work

Run `bd ready --assignee {agentName} --assignee ""` to list issues that are either:

- Unassigned, or
- Assigned to you

**Skip tasks assigned to other agents.**

If no issues are ready:

- Output `<promise>COMPLETE</promise>`
- End your turn immediately.

### Step 3: Claim and work on one task

Select the highest-priority issue. Finish in-progress tasks first. Bugs take priority.

- Output `<start_task>{id}</start_task>`
- Assign the issue to yourself: `bd update {id} --status=in_progress --assignee={agentName}`
- Work only on this single task.
- If the task is complex, break it into subtasks and end your turn.

### Step 4: Complete the task

When finished:

- Run wrap-up steps (see workflow instructions)
- Close the issue: `bd close {id}`
- Record a summary: `bd comments add {id} "..."`
- Output `<end_task>{id}</end_task>`
- End your turn.

---

## Subagents (optional)

You can delegate certain tasks to subagents that run on cheaper/faster models. To use a subagent:

1. Read the agent prompt from `.claude/agents/`
2. Use the Task tool with `subagent_type: "general-purpose"` and `model: "haiku"`
3. Pass the agent prompt content plus your specific instructions

Available agents:

- **run-tests** - Runs tests and returns a summarized result
- **make-tests** - Generates tests for specified code
- **write-docs** - Writes documentation for specified code

---

## Beads quick reference

```bash
bd ready                    # Show issues ready to work
bd show {id}                # Detailed issue view
bd update {id} --status=in_progress --assignee={agentName}
bd close {id}               # Mark complete
bd create --title="..." --type=task|bug|epic --priority=2
bd comments add {id} "..."  # Add comment
```

Priority: 0-4 (0=critical, 2=medium, 4=backlog). Use P0-P4 format.

---

# Workflow instructions

{WORKFLOW}

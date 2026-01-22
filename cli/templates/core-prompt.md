# Ralph Iteration Protocol

You are running as an autonomous iteration agent. Follow this protocol exactly.

## CRITICAL: Running tests

**NEVER run test commands directly with Bash.** Always use a subagent.

To run tests, first read the agent prompt, then spawn a Task:

```
# Step 1: Read the agent prompt
Read .claude/agents/run-tests.md

# Step 2: Spawn subagent with Task tool
Task(
  description: "Run tests",
  subagent_type: "general-purpose",
  model: "haiku",
  prompt: "<paste run-tests.md content here>\n\nRun: pnpm test:all"
)
```

The subagent runs tests and returns a summary. This keeps verbose output out of your context.

---

## Iteration lifecycle

### Step 1: Check for errors

Spawn a **run-tests subagent** (see above) to check for build/test errors.

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

## Other subagents

**Writing tests** - spawn make-tests subagent:

```
Read .claude/agents/make-tests.md
Task(
  description: "Write tests for X",
  subagent_type: "general-purpose",
  model: "haiku",
  prompt: "<make-tests.md content>\n\nWrite tests for: {description}"
)
```

**Writing documentation** - spawn write-docs subagent:

```
Read .claude/agents/write-docs.md
Task(
  description: "Document X",
  subagent_type: "general-purpose",
  model: "haiku",
  prompt: "<write-docs.md content>\n\nDocument: {description}"
)
```

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

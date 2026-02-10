# Concurrent Ralph Workers

## Goal

Run multiple Ralph workers in parallel within a single repo, each in its own git worktree, to speed up task throughput.

## Current State

- One Ralph worker per workspace, running in the main working directory
- SharedWorker manages a single WebSocket connection per workspace
- Sessions are sequential: one task at a time, loop until `bd ready` is empty
- Worktree shell helpers exist (`wt`, `wtrm`, etc.) but aren't used by Ralph

## Design

### Worker model

- A configurable number of workers (hard-coded initially, e.g. 3)
- Each worker has a Simpsons character name (e.g. `homer`, `marge`, `bart`)
- Workers operate independently with no direct awareness of each other
- Each worker loops: pull main, claim task, work in worktree, merge, clean up, repeat
- Workers never give up on a task — they keep going until it's done

### Task assignment

- Workers independently pull from `bd ready`
- When claiming a task, a worker sets `--status=in_progress --assignee=<worker-name>`
- Other workers skip tasks that are already assigned
- No central coordinator needed; `bd` assignment acts as a lightweight lock
- Each spawn of Claude sees current `bd ready` state, so newly unblocked tasks are picked up naturally

### Worktree lifecycle

- Worker pulls latest main before starting each task
- Worktree created on-the-fly per task: `git worktree add` with a task-specific branch
- Worker does all work within its worktree
- After task completion, worker merges its branch into main
- Worktree and branch are cleaned up after successful merge
- Branch naming convention: e.g. `ralph/<worker-name>/<task-id>`

### Merge strategy

- Worker merges into main after each completed task (not batched)
- If merge conflicts arise, the agent resolves them (AI-assisted)
- After merge, worker runs tests to verify clean integration
- If tests fail post-merge, worker continues fixing until tests pass
- Other workers pull latest main before starting their next task, so drift is minimized

### Controls

- All workers spin up together when there are enough ready tasks
- Individual workers can be paused/stopped independently
- "Stop after current" is global: every worker finishes its current task, merges, then stops
- No rate limit throttling for now

### UI changes

- Reuse existing session history dropdown
- Add visual indicator for active vs. completed sessions
- Each worker gets its own session, all visible in the dropdown
- No new panels or tabs needed

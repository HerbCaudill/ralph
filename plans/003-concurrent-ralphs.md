# Concurrent Ralphs

## Goal

Enable running multiple Ralph instances simultaneously within the same UI, each working on different tasks independently with proper isolation via git worktrees.

## Approach

### Git worktree isolation

Each Ralph instance gets its own git worktree, allowing parallel work without conflicts:

```
project/                     # Main worktree (main branch)
project-worktrees/           # Sibling folder for worktrees
  alice-abc123/              # Alice's worktree (branch: ralph/alice-abc123)
  bob-def456/                # Bob's worktree (branch: ralph/bob-def456)
```

**Workflow per instance:**
1. On instance creation: `git worktree add ../project-worktrees/{name}-{id} -b ralph/{name}-{id}`
2. Ralph runs in the worktree directory
3. After each iteration: agent resolves any conflicts, then merges branch back to main, rebases worktree on updated main
4. On instance removal: merge final changes, `git worktree remove`, delete branch

### Task assignment

Agents must assign tasks to themselves when starting work. The beads `--assignee` field prevents other agents from picking up the same task. Agents should check assignee before claiming a task.

### Persistence

- **Server state:** Instance registry persisted to `.ralph/instances.json`
- **Browser state:** Active instance ID in localStorage, full state hydrated from server on connect

### Registry pattern

Convert singletons to registries keyed by instance ID:
- `RalphRegistry` → manages `RalphManager` instances
- `BdProxyRegistry` → one `BdProxy` per workspace (shared across instances in same workspace)
- `WorktreeManager` → handles git worktree lifecycle

## Tasks

### Git worktree management

1. Create `WorktreeManager` class to handle worktree lifecycle (create, merge, rebase, remove)
2. Implement worktree creation on instance start (`git worktree add`)
3. Implement post-iteration merge workflow (merge instance branch → main, rebase instance on main)
4. Implement worktree cleanup on instance removal
5. Handle merge conflicts (agent resolves conflicts during merge, retry if resolution fails)
6. ~~Add `.worktrees/` to `.gitignore`~~ (not needed - worktrees in sibling folder)

### Server-side instance management

7. Create `RalphRegistry` class to manage multiple `RalphManager` instances
8. Create `InstanceStore` for persistence (`instances.json`: id, name, workspace, agent, worktreePath, status)
9. Update `RalphManager` to run in worktree directory instead of main workspace
10. Update REST API endpoints to accept instance ID parameter
11. Add instance ID to all WebSocket message payloads
12. Track event history per instance (Map instead of global array)
13. Track current task per instance
14. Create `BdProxyRegistry` - one BdProxy per workspace, shared across instances
15. Add REST endpoints: list instances, create instance, delete instance, get instance metadata
16. Restore running instances on server restart (re-spawn processes for instances marked as running)

### Task assignment integration

17. Update prompt templates to instruct agents to assign tasks to themselves
18. Add agent name/ID to instance metadata for use in task assignment
19. Agents should check `--assignee` before claiming tasks and skip assigned tasks

### Frontend state changes

20. Add `RalphInstance` type with per-instance state
21. Refactor `AppState` to use `Map<instanceId, RalphInstance>`
22. Add `activeInstanceId` to track displayed instance
23. Add store actions: `createInstance`, `removeInstance`, `setActiveInstance`
24. Persist active instance ID in localStorage
25. Hydrate full instance list from server on WebSocket connect

### Frontend UI changes

26. Create `InstanceSelector` dropdown in header
27. Create `InstanceBadge` showing status indicator
28. Create "New Instance" dialog (name input, workspace selector, agent selector)
29. Update `useRalphConnection` to route messages by instance ID
30. Update `EventStream` to filter by active instance ID
31. Update control buttons to operate on active instance
32. Show merge status in UI (conflicts being resolved, merge complete, etc.)
33. Add instance management panel (list all instances, stop/remove actions)

### Integration and polish

34. Auto-select newly created instance as active
35. Clean up instance state when instance exits
36. Show instance count badge when multiple running
37. Handle edge case: instance worktree deleted externally
38. Add instance status to header (e.g., "Alice: running task 'Fix login bug'")

## Decisions

1. **Merge frequency:** Merge after every iteration
2. **Conflict resolution:** Agents resolve conflicts themselves before merging
3. **Worktree location:** Sibling folder (`{project}-worktrees/`)
4. **Branch cleanup:** Auto-delete branches after merge

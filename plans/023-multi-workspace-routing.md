# Multi-Workspace URL Routing and Process Management

## Goal

Support multiple browser tabs open to different workspaces simultaneously, with proper URL-based routing and one Ralph process per workspace.

## Current State

- Workspace identifier is filesystem path (e.g., `/Users/herbcaudill/Code/HerbCaudill/ralph`)
- No URL routing: app always shows at root `/`
- SharedWorker manages a single global Ralph process
- Workspace selection managed client-side via `useWorkspace` hook
- Task dialog state in URL hash (`#taskid=r-abc99`)
- UI connects to beads-server (port 4243) and agent-server (port 4244)

## Approach

### 1. Workspace Identifier Change

Replace filesystem paths with repo-style identifiers (`owner/repo` format):

- **Before:** `/Users/herbcaudill/Code/HerbCaudill/ralph`
- **After:** `herbcaudill/ralph`

Derive from:

- Git remote URL (extract owner/repo from GitHub/GitLab URLs)
- Fallback: last two segments of path (`HerbCaudill/ralph`)

### 2. URL Structure

```
/                                 → Redirect to most recent workspace
/{owner}/{repo}                   → Workspace view (no session)
/{owner}/{repo}/{sessionId}       → Session view
#taskid={taskId}                  → Task detail (in hash, as currently)
```

**Examples:**

- `/herbcaudill/ralph` — Workspace view
- `/herbcaudill/ralph/abcd1234` — Session view
- `/herbcaudill/ralph/abcd1234#taskid=r-zfy9a` — Session + task detail

### 3. Per-Workspace Ralph Processes

Modify SharedWorker to manage multiple Ralph processes:

- Key by workspace ID (`owner/repo`)
- Each workspace maintains independent state (controlState, sessionId, ws connection)
- Browser tab subscribes to events for its current workspace
- WebSocket connection URLs include workspace ID

### 4. React Router Integration

Add React Router v6 for URL-based navigation:

- Route definitions for workspace/session URLs
- URL params extract `owner`, `repo`, `sessionId`
- Navigate on workspace switch
- Preserve existing hash-based task dialog routing

### 5. State Synchronization

- SharedWorker broadcasts workspace-scoped events
- UI components subscribe to current workspace only
- localStorage stores most recent workspace per browser (not per tab)
- Redirect root `/` to most recent workspace from localStorage

## Implementation Tasks

1. **Workspace identifier extraction** — Add function to derive `owner/repo` from git remotes
2. **URL routing setup** — Install React Router v6, define routes, add navigation
3. **SharedWorker refactor** — Multi-workspace state management, scoped WebSocket connections
4. **API client updates** — Include workspace ID in request URLs/headers
5. **beads-server changes** — Accept workspace ID as URL param or header
6. **agent-server changes** — Accept workspace ID in WebSocket protocol
7. **Component updates** — Use router params, navigate on workspace switch
8. **localStorage migration** — Convert stored paths to workspace IDs
9. **Root redirect** — Implement `/` → `/{owner}/{repo}` redirect logic

## Migration Strategy

**Backward compatibility:**

- beads-server accepts both full paths and workspace IDs
- localStorage migration on first load (convert paths to IDs)
- Fallback if git remote extraction fails (use last two path segments)

**Deployment:**

1. Deploy server changes (accept both formats)
2. Deploy UI changes (switch to workspace IDs)
3. Users' old paths automatically migrate to workspace IDs on first load

## Design Decisions

1. **Monorepos:** A monorepo is a single workspace. Use the first git remote found for the workspace ID.

2. **Name collisions:** Not a concern - each workspace will have a unique `owner/repo` identifier.

3. **WebSocket subscriptions:** Tabs unsubscribe from workspaces when navigating away. Don't keep all workspace connections alive.

4. **Session auto-start:** Ralph does NOT auto-start when navigating to `/{owner}/{repo}`. Requires explicit user action (start button).

5. **Session persistence:** Session IDs persist across page reloads. Restore the most recent session for each workspace on reload.

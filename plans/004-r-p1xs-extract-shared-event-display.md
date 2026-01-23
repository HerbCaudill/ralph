# Plan: Extract Shared Event Display Logic (r-p1xs)

## Summary

Extract duplicated tool result extraction logic into a shared `useToolResults` hook. This eliminates ~27 lines of duplicated code across 3 files.

## Current State

Tool result map creation is duplicated in:
- `EventStream.tsx` (lines 91-115) - not memoized
- `TaskChatPanel.tsx` (lines 49-72) - memoized
- `EventLogViewer.tsx` (lines 39-59) - not memoized

## Approach

Minimal hook-only approach:
1. Create `useToolResults` hook that extracts tool results from events
2. Refactor the 3 components to use the hook
3. Skip creating a shared rendering component (rendering patterns differ too much)

## Files to Create

| File | Purpose |
|------|---------|
| `ui/src/hooks/useToolResults.ts` | Hook to extract tool results from events |
| `ui/src/hooks/useToolResults.test.ts` | Unit tests |

## Files to Modify

| File | Changes |
|------|---------|
| `ui/src/components/events/EventStream.tsx` | Replace inline extraction with `useToolResults` |
| `ui/src/components/chat/TaskChatPanel.tsx` | Replace memoized extraction with `useToolResults` |
| `ui/src/components/events/EventLogViewer.tsx` | Replace inline extraction with `useToolResults` |

## Implementation Steps

1. Create `useToolResults` hook with proper memoization
2. Add unit tests for the hook
3. Refactor EventStream to use hook (remove ~25 lines)
4. Refactor TaskChatPanel to use hook (remove ~24 lines)
5. Refactor EventLogViewer to use hook (remove ~21 lines)
6. Run tests and verify behavior unchanged

## Hook Interface

```typescript
type ToolResultsMap = Map<string, { output?: string; error?: string }>

function useToolResults(events: RalphEvent[]): ToolResultsMap
```

## Verification

1. Run `pnpm ui:test` - all tests pass
2. Manual test: Start UI, trigger some tool uses, verify results display correctly
3. Verify streaming behavior unchanged in both EventStream and TaskChatPanel

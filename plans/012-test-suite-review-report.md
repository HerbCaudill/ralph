# Unit Test Suite Review Report

## Summary

- Test files: 186 (118 .ts, 68 .tsx)
- Approx test cases (`it`/`test`): 4,257
- Test blocks (`describe`/`it`/`test`): 5,571
- Concentration: top 20 files hold ~35.7% of test blocks
- Distribution (test blocks): ui 5,101; cli 280; shared 190

## High-value coverage (keep)

These tests map directly to core workflows, persistence, and orchestration, and look worth keeping even if consolidated later.

- Persistence and session lifecycle
  - `ui/src/lib/persistence/EventDatabase.test.ts`
  - `ui/src/lib/persistence/writeQueue.test.ts`
  - `ui/src/lib/ralphConnection.test.ts`
  - `ui/src/hooks/useSessionPersistence.test.ts`
  - `ui/src/hooks/useRalphConnection.test.ts`
- Event stream rendering and filtering
  - `ui/src/components/events/EventStream.test.tsx`
  - `ui/src/lib/EventFilterPipeline.test.ts`
  - `ui/src/lib/eventToBlocks.test.ts`
- Task chat regressions
  - `ui/src/components/chat/TaskChatPanel.replay.test.tsx`
  - `ui/server/TaskChatEventPersister.test.ts`
  - `ui/server/TaskChatManager.test.ts`
- Server orchestration
  - `ui/server/SessionRunner.test.ts`
  - `ui/server/RalphManager.test.ts`
  - `ui/server/RalphRegistry.test.ts`

## Likely unnecessary or low-value tests (candidates to remove)

These appear to provide minimal signal beyond TypeScript checking or trivial branching.

- Type guard truth tables
  - `shared/src/events/guards.test.ts`
  - `ui/src/lib/isAssistantMessage.test.ts`
  - `ui/src/lib/isErrorEvent.test.ts`
  - `ui/src/lib/isRalphTaskCompletedEvent.test.ts`
  - `ui/src/lib/isRalphTaskStartedEvent.test.ts`
  - `ui/src/lib/isStreamEvent.test.ts`
  - `ui/src/lib/isSystemEvent.test.ts`
  - `ui/src/lib/isToolResultEvent.test.ts`
  - `ui/src/lib/isUserMessageEvent.test.ts`
- Type-only assertions
  - `shared/src/beads/types.test.ts`
- Simple helpers that are effectively “enum checks”
  - `ui/src/lib/cn.test.ts`
  - `ui/src/lib/getContrastingColor.test.ts`
  - `ui/src/lib/stripTaskPrefix.test.ts`

## Redundant or over-specified tests (candidates to consolidate)

These test the same behavior repeatedly with slightly different inputs. They likely can be reduced to table-driven tests or a smaller representative subset.

- Command/option permutations
  - `ui/server/BdProxy.test.ts` (many near-identical tests for option flags)
- Per-tool UI summaries
  - `ui/src/components/events/ToolUseCard.test.tsx`
- Per-status UI variants
  - `ui/src/components/tasks/TaskCard.test.tsx`
  - `ui/src/components/tasks/TaskList.test.tsx`
- Repeated fetch + render sequences
  - `ui/src/components/layout/WorkspacePicker.test.tsx`
  - `ui/src/components/layout/SettingsDropdown.test.tsx`

## Gaps to watch

- End-to-end coverage of full event flow (server → WebSocket → UI) is limited; most tests are unit-level.
- CLI “run sessions” E2E is present but environment-dependent; watch mode is validated mostly on the server side.
- Workspace switching + persistence across reloads lacks a dedicated E2E test.

## Recommended quick wins (if you want to reduce test count)

1. Remove type-only tests (shared type guard and type assertion tests).
2. Collapse per-variant UI tests into table-driven cases (one test per feature group).
3. Keep a small representative subset of BdProxy option tests and use a single table-driven test for flags.
4. Preserve replay/persistence/orchestration tests as core regression guards.

## Rough impact estimate

If you remove the type-guard/type-only tests and consolidate the repetitive UI/option-flag tests, you could likely drop 10–20% of test cases without losing meaningful coverage. The biggest savings are in UI components + utility guards.

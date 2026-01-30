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
  - `packages/ui/src/lib/persistence/EventDatabase.test.ts`
  - `packages/ui/src/lib/persistence/writeQueue.test.ts`
  - `packages/ui/src/lib/ralphConnection.test.ts`
  - `packages/ui/src/hooks/useSessionPersistence.test.ts`
  - `packages/ui/src/hooks/useRalphConnection.test.ts`
- Event stream rendering and filtering
  - `packages/ui/src/components/events/EventStream.test.tsx`
  - `packages/ui/src/lib/EventFilterPipeline.test.ts`
  - `packages/ui/src/lib/eventToBlocks.test.ts`
- Task chat regressions
  - `packages/ui/src/components/chat/TaskChatPanel.replay.test.tsx`
  - `packages/ui/server/TaskChatEventPersister.test.ts`
  - `packages/ui/server/TaskChatManager.test.ts`
- Server orchestration
  - `packages/ui/server/SessionRunner.test.ts`
  - `packages/ui/server/RalphManager.test.ts`
  - `packages/ui/server/RalphRegistry.test.ts`

## Likely unnecessary or low-value tests (candidates to remove)

These appear to provide minimal signal beyond TypeScript checking or trivial branching.

- Type guard truth tables
  - `packages/shared/src/events/guards.test.ts`
  - `packages/ui/src/lib/isAssistantMessage.test.ts`
  - `packages/ui/src/lib/isErrorEvent.test.ts`
  - `packages/ui/src/lib/isRalphTaskCompletedEvent.test.ts`
  - `packages/ui/src/lib/isRalphTaskStartedEvent.test.ts`
  - `packages/ui/src/lib/isStreamEvent.test.ts`
  - `packages/ui/src/lib/isSystemEvent.test.ts`
  - `packages/ui/src/lib/isToolResultEvent.test.ts`
  - `packages/ui/src/lib/isUserMessageEvent.test.ts`
- Type-only assertions
  - `packages/shared/src/beads/types.test.ts`
- Simple helpers that are effectively “enum checks”
  - `packages/ui/src/lib/cn.test.ts`
  - `packages/ui/src/lib/getContrastingColor.test.ts`
  - `packages/ui/src/lib/stripTaskPrefix.test.ts`

## Redundant or over-specified tests (candidates to consolidate)

These test the same behavior repeatedly with slightly different inputs. They likely can be reduced to table-driven tests or a smaller representative subset.

- Command/option permutations
  - `packages/ui/server/BdProxy.test.ts` (many near-identical tests for option flags)
- Per-tool UI summaries
  - `packages/ui/src/components/events/ToolUseCard.test.tsx`
- Per-status UI variants
  - `packages/ui/src/components/tasks/TaskCard.test.tsx`
  - `packages/ui/src/components/tasks/TaskList.test.tsx`
- Repeated fetch + render sequences
  - `packages/ui/src/components/layout/WorkspacePicker.test.tsx`
  - `packages/ui/src/components/layout/SettingsDropdown.test.tsx`

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

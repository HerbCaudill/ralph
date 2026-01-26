# Plan: Migrate Playwright Tests to Storybook Interaction Tests

## Summary

Migrate ~15 component-level Playwright tests to Storybook interaction tests using play functions. Keep ~23 tests as Playwright E2E tests (require full app context, backend, or global hotkeys).

## Tests to Migrate

### HotkeysDialog (3 tests → new story)

From `navigation.spec.ts`:

- `Cmd+/ opens hotkeys dialog` → `HotkeysDialog.stories.tsx` with `open={true}`
- `hotkeys dialog shows categories` → verify Navigation/Agent Control categories visible
- `Escape closes hotkeys dialog` → play function tests onClose callback

### CommandPalette (5 tests → new story)

From `navigation.spec.ts`:

- `Cmd+; opens command palette` → `CommandPalette.stories.tsx` with `open={true}`
- `command palette shows search input` → verify input visible
- `clicking backdrop closes command palette` → play function clicks backdrop
- `can search commands in palette` → type "theme", verify command visible
- `selecting a command closes palette` → click command, verify onClose called

### QuickTaskInput (4 tests → add play functions to existing story)

From `quick-task-input.spec.ts`:

- `clears input after successful task submission` → mock fetch success
- `clears localStorage draft after successful task submission`
- `retains focus on input after successful submission`
- `keeps input value on API error` → mock fetch error

### Hotkey Verification (3 tests → HotkeysDialog story)

From `navigation.spec.ts`:

- `session navigation hotkeys are registered` → verify text in dialog
- `task navigation hotkeys are registered` → verify text in dialog

## Tests to Keep in Playwright E2E (~23 tests)

**Require global hotkey registration (useHotkeys at App level):**

- All `Cmd+K`, `Cmd+F`, `Cmd+B`, `Cmd+J`, `Cmd+1`, `Cmd+2`, `Cmd+Shift+T` tests
- Focus management tests that require global keyboard handlers
- Search input show/hide via global hotkey

**Require full app context:**

- Layout visibility tests (sidebar, event stream, chat input, control bar)
- Panel toggle tests (CSS transitions + panel state)
- Responsive layout tests

## Infrastructure Setup

### 1. Install Storybook test addon

```bash
pnpm --filter @herbcaudill/ralph-ui add -D @storybook/addon-test @storybook/experimental-addon-test
```

### 2. Add test utilities

Create `ui/.storybook/test-utils.ts`:

- `mockFetch()` - mock global fetch for API tests
- `clearLocalStorage()` - clean localStorage between tests

### 3. Update package.json scripts

```json
"test:storybook": "vitest --project=storybook"
```

## Implementation

### Phase 1: Infrastructure

1. Install `@storybook/addon-test` (or use built-in Vitest runner)
2. Create `test-utils.ts` with fetch mocking helpers
3. Verify Storybook tests can run via `pnpm test:storybook`

### Phase 2: Create new stories with play functions

1. `HotkeysDialog.stories.tsx` - open/close, verify categories
2. `CommandPalette.stories.tsx` - search, select, backdrop click

### Phase 3: Add play functions to existing story

1. `QuickTaskInput.stories.tsx` - add interaction tests with mocked API

### Phase 4: Remove migrated tests from Playwright

1. Delete tests from `navigation.spec.ts` that are now in Storybook
2. Delete `quick-task-input.spec.ts` entirely (all tests migrated)

## Files to Create/Modify

**Create:**

- `ui/.storybook/test-utils.ts`
- `ui/src/components/layout/HotkeysDialog.stories.tsx`
- `ui/src/components/layout/CommandPalette.stories.tsx`

**Modify:**

- `ui/.storybook/main.ts` - add test addon
- `ui/src/components/tasks/QuickTaskInput.stories.tsx` - add play functions
- `ui/package.json` - add test script
- `ui/e2e/navigation.spec.ts` - remove migrated tests
- `ui/e2e/quick-task-input.spec.ts` - delete file

## Verification

1. Run `pnpm storybook` and verify new stories render correctly
2. Run `pnpm test:storybook` and verify all play functions pass
3. Run `pnpm test:pw` and verify remaining E2E tests still pass
4. Run `pnpm test:all` to confirm full test suite works

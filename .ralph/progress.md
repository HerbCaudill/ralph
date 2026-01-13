# Progress Log

This file tracks completed tasks and changes made to the codebase during ralph iterations.

Each entry should include:

- What was changed
- Why it was changed
- Any important notes for future work

---

## 2026-01-12: Improved initialization prompt UI

**What:** Replaced the simple yes/no keyboard input with a nicer selection UI using `ink-select-input`

**Why:** To provide a better, more intuitive user experience when prompted to initialize the ralph project. The new UI shows clear options with descriptive labels and supports arrow key navigation.

**Changes:**

- Added `ink-select-input` dependency to package.json (version 6.2.0)
- Modified `src/components/IterationRunner.tsx`:
  - Imported `SelectInput` from `ink-select-input`
  - Removed the `useInput` hook that was handling raw keyboard input (y/n/Esc keys)
  - Created `handleInitSelection` function to handle the selection callback
  - Replaced the simple text prompt with a `SelectInput` component showing two options:
    - "Yes, initialize the project"
    - "No, exit"
- Kept the non-TTY fallback behavior unchanged (shows instruction to run `ralph init`)

**Notes:** All 78 tests pass. The new UI provides a cleaner, more discoverable interface with arrow key navigation and Enter to confirm, replacing the previous single-key (y/n) input method.

---

## 2026-01-12: Added box border around header

**What:** Added a full border box around the entire header component instead of just a bottom border

**Why:** Visual improvement to make the header stand out more clearly and create better visual separation from the content

**Changes:**

- Modified `src/components/Header.tsx` to add `borderStyle="single"` to the outer Box component
- Added `padding={1}` to provide spacing inside the border
- Removed the separate bottom-border-only Box element that was previously used

**Notes:** All 78 tests pass. The header now has a complete single-line border around it with padding for better visual presentation.

---

## 2026-01-12: Display ralph version alongside Claude Code version in header

**What:** Updated header to show both ralph version and Claude Code version on the same line

**Why:** To provide users with clear visibility of both tool versions at a glance

**Changes:**

- Modified `src/cli.ts` to import version from `package.json` using JSON import assertions
- Updated `.version()` call in Commander to use `packageJson.version` instead of hardcoded string
- Added `ralphVersion` parameter to App component and passed it through to Header
- Updated Header component to accept both `claudeVersion` and `ralphVersion` props
- Changed header display format to: `@herbcaudill/ralph v{ralphVersion} • Claude Code v{claudeVersion}`
- Updated all Header tests to use the new two-parameter API

**Notes:** All 78 tests pass. The version is now dynamically loaded from package.json, ensuring it stays in sync with the actual published version.

---

## 2026-01-12: Fixed Claude Code version display

**What:** Implemented automatic Claude version detection by calling `claude --version` at startup

**Why:** The version was showing as "unknown" because it was reading from an undefined environment variable `CLAUDE_VERSION`

**Changes:**

- Created `src/lib/getClaudeVersion.ts` that executes `claude --version` and extracts the version number
- Updated `src/cli.ts` to use `getClaudeVersion()` instead of reading from environment variable
- Added comprehensive unit tests in `src/lib/getClaudeVersion.test.ts` (6 test cases)

**Notes:** The function gracefully handles errors and returns "unknown" if the claude command fails or produces unexpected output. All tests pass (75 total).

---

## 2026-01-12: Fixed inline code blocks appearing in separate paragraphs

**What:** Fixed a bug where inline code (e.g., `console.log()`) was being rendered on separate lines with unwanted gaps instead of flowing inline with the surrounding text

**Why:** Claude's message content can contain multiple consecutive text blocks (e.g., "Use the ", "`console.log()`", " function"). Each was being rendered as a separate component with gaps between them due to Ink's column layout.

**Changes:**

- Modified `src/components/eventToBlocks.ts` to merge consecutive text blocks into a single content block before rendering
- Added a textBuffer that accumulates consecutive text blocks and only flushes when encountering a tool_use block or at the end
- Wrapped StreamingText content in a `<Box>` component to prevent Ink from treating multiple `<Text>` children as separate blocks
- Added new test in `EventDisplay.test.tsx` to verify consecutive text blocks are merged and rendered on one line
- Updated existing tests in `eventToBlocks.test.ts` to reflect the new merging behavior

**Notes:** The fix works at two levels: (1) merging consecutive text blocks in eventToBlocks, and (2) using a Box wrapper in StreamingText to keep formatted text segments inline. All 77 tests pass.

---

## 2026-01-12: Added gradient color to header text

**What:** Implemented ink-gradient for the "Ralph" header text using custom colors from blue (#30A6E4) to yellow (#EBC635)

**Why:** Visual enhancement to make the header more distinctive and polished

**Changes:**

- Added `ink-gradient` dependency to package.json
- Updated `src/components/Header.tsx` to import and use the Gradient component
- Wrapped the BigText component with Gradient, passing colors prop with the specified hex colors
- Removed the old colors prop from BigText (which was cyan/magenta)

**Notes:** All 78 tests pass. The gradient provides a smooth color transition from blue to yellow across the "Ralph" title text.

---

## 2026-01-13: Fixed LSP server notification error

**What:** Added `ENABLE_LSP_TOOL=0` environment variable when spawning Claude CLI to disable LSP plugins

**Why:** The TypeScript LSP server was causing errors like `Cannot send notification to LSP server 'plugin:typescript-lsp:typescript': server is error` which could crash the process. This fix was previously implemented on the `worktrees` branch but hadn't been merged to main.

**Changes:**

- Modified `src/components/IterationRunner.tsx` to pass an `env` option when spawning the Claude CLI process
- The environment includes all existing process environment variables plus `ENABLE_LSP_TOOL: "0"`

**Notes:** All 85 tests pass. This fix was cherry-picked from commit c7ca452 on the worktrees branch.

---

## 2026-01-13: Fixed terminal scrolling behavior

**What:** Replaced dynamic Box rendering with Ink's Static component for content blocks in EventDisplay

**Why:** When scrolling up with the mouse wheel/scrollbar, users couldn't scroll back down again. This was because Ink was re-rendering content at the cursor position, which confused the terminal's scrollback buffer. The Static component renders content permanently to the scrollback buffer, allowing natural terminal scrolling.

**Changes:**

- Modified `src/components/EventDisplay.tsx` to use `<Static items={contentBlocks}>` instead of `<Box flexDirection="column" gap={1}>`
- Each content block is now wrapped in a Box with conditional `marginTop` (0 for first item, 1 for others) to maintain spacing
- Updated inline snapshots in `EventDisplay.replay.test.tsx` to account for the slight formatting difference (trailing newline after Static content)

**Notes:** All 85 tests pass. The Static component is designed for exactly this use case - rendering completed/historical content that shouldn't change while keeping dynamic content (like the spinner) at the bottom.

# Progress Log

This file tracks completed tasks and changes made to the codebase during ralph iterations.

Each entry should include:

- What was changed
- Why it was changed
- Any important notes for future work

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

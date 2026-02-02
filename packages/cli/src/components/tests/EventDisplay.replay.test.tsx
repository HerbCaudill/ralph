import { describe, it, expect } from "vitest"
import { replay } from ".././replay.js"

describe("EventDisplay replay tests", () => {
  it("replays 1.txt", async () => {
    expect(await replay("1.txt")).toMatchInlineSnapshot(`
      "

      ─── Round 1 ───

      I'll start by checking the types, unit tests, and end-to-end tests as instructed.

        TodoWrite
          [~] Run typecheck to verify types
          [ ] Run unit tests via pnpm test
          [ ] Run end-to-end tests via pnpm test:pw

        $ pnpm typecheck

      Good! Types check successfully. Now let me run the unit tests.

        TodoWrite
          [x] Run typecheck to verify types
          [~] Run unit tests via pnpm test
          [ ] Run end-to-end tests via pnpm test:pw

        $ pnpm test

      Perfect! Unit tests pass. Now let me run the end-to-end tests.

        TodoWrite
          [x] Run typecheck to verify types
          [x] Run unit tests via pnpm test
          [~] Run end-to-end tests via pnpm test:pw

        $ pnpm test:pw
      "
    `)
  })

  it("replays 2.txt", async () => {
    expect(await replay("2.txt")).toMatchInlineSnapshot(`
      "

      ─── Round 1 ───

      I'll start by checking that the project builds successfully and running tests.

        $ pnpm build

        $ pnpm test

      Good! The build is successful and all tests pass. Now let me check the todo list to find the
      highest-priority task.

        Read .ralph/todo.md

      Looking at the todo list, I'll prioritize the "Inline code blocks are being put in separate
      paragraphs" issue. This is a functional bug affecting the display quality, whereas the others are
      enhancements. Let me investigate this issue first.

        Read src/components/StreamingText.tsx

      Let me check the tests to understand the expected behavior and see if there's a failing test case:

        Read src/components/StreamingText.test.tsx

      I need to understand where StreamingText is being used and what the actual problem is. Let me check
      where it's called from and look at some example output:

        Grep StreamingText

        Read src/components/EventDisplay.tsx

      I see the issue now! In EventDisplay.tsx:70, there's a <Box flexDirection="column" gap={1}> which
      wraps each StreamingText component. Each StreamingText (which represents text blocks) is being
      placed in its own box with a gap, causing inline code to appear in separate paragraphs.

      The problem is that each text block from Claude's message content is being rendered as a separate
      StreamingText component with gaps between them. This works fine for separate paragraphs, but inline
      code within a sentence gets split incorrectly.

      Let me look at how the events are being split into blocks:

        Read src/components/eventToBlocks.ts

      Now I understand the issue. Claude's message content can have multiple text blocks (e.g., "Here's
      the code: ", then a tool_use block, then " and that's it"). Each text block becomes a separate
      ContentBlock with type "text", and EventDisplay renders each one as a separate <StreamingText>
      component in a Box with gap={1}, causing unwanted spacing.

      The fix should be to merge consecutive text blocks together. Let me write a test first to
      demonstrate the problem:

        Read src/components/EventDisplay.test.tsx

      Now let me add a test that demonstrates the inline code block problem and then fix it:

        Edit src/components/EventDisplay.test.tsx

      Now let me run the test to confirm it fails (demonstrating the problem):

        $ pnpm test EventDisplay.test.tsx

      Perfect! The test fails as expected, confirming the bug. Now I need to fix it by modifying
      eventToBlocks to merge consecutive text blocks:

        Edit src/components/eventToBlocks.ts

      Now I need to also flush the text buffer at the end of the loop:

        Edit src/components/eventToBlocks.ts

      Now let me run the tests again to verify the fix works:

        $ pnpm test EventDisplay.test.tsx

      The test still fails. This suggests the problem might also be in EventDisplay, not just
      eventToBlocks. Let me debug by adding a simpler test to see what's happening in eventToBlocks:

        Read src/components/eventToBlocks.test.ts

      I see! The existing test "extracts multiple text blocks" expects them NOT to be merged. I need to
      update this test and add a new one specifically for consecutive text blocks:

        Edit src/components/eventToBlocks.test.ts

      Now let me add a test for text blocks separated by tool calls:

        Read src/components/eventToBlocks.test.ts

      Let me add a test that specifically checks text blocks separated by tool calls:

        Edit src/components/eventToBlocks.test.ts

      Now let me run all tests to verify my changes to eventToBlocks work:

        $ pnpm test eventToBlocks.test.ts

      I need to look at this failing test:

        Read src/components/eventToBlocks.test.ts

      This test expects 3 separate IDs for 3 text blocks, but my code now merges them into 1. I need to
      update this test to reflect the new behavior:

        Edit src/components/eventToBlocks.test.ts

      Now let me run the eventToBlocks tests again:

        $ pnpm test eventToBlocks.test.ts

      Great! Now let me run the EventDisplay test again:

        $ pnpm test EventDisplay.test.tsx

      The problem is still happening at the EventDisplay level. Let me check what's actually being
      rendered. The issue must be in how EventDisplay merges the events. Let me look more carefully at the
       EventDisplay logic:

        Read src/components/EventDisplay.tsx

      I see! The EventDisplay is doing its own deduplication, but it's NOT merging consecutive text
      blocks. The text blocks in the test data remain separate even after eventToBlocks merges them,
      because my test is creating a single event with 3 separate text blocks in content.

      Wait, let me re-check the flow. EventDisplay calls eventToBlocks on each merged event. So if
      eventToBlocks correctly merges text blocks, then EventDisplay should get a single merged text block.
       Let me debug by adding a console log or looking at what's actually happening.

      Let me write a simpler test to see what's going on:

        $ cat > test-merge.ts << 'EOF'
      import { eventToBlocks } from "./src/components/eventToBlocks.js"

      const event = {
       type: "assistant",
       message: {
       id: "msg_123",
       content: [
       { type: "text", text: "Use the " },
       { type: "text", text: "\`console.log()\`" },
       { type: "text", text: " function to debug." },
       ],
       },
      }

      const result = eventToBlocks(event)
      console.log("Result:", JSON.stringify(result, null, 2))
      EOF
      tsx test-merge.ts

      Let me check if my fix is actually working by looking at the eventToBlocks implementation more
      carefully. Actually, let me just trace through what should happen:

      1. eventToBlocks receives an event with 3 text blocks
      2. It loops through content
      3. First text block: adds "Use the " to textBuffer
      4. Second text block: adds "console.log()" to textBuffer (now "Use the console.log()")
      5. Third text block: adds " function to debug." to textBuffer (now "Use the console.log() function
      to debug.")
      6. After the loop, it flushes the textBuffer as one merged text block

      That should work! Let me check if there's an issue with my implementation. Let me re-read the code:

        Read src/components/eventToBlocks.ts

      The code looks correct. Let me check if the EventDisplay is receiving the correct merged content. I
      think the issue might be in how EventDisplay deduplicates and merges content before calling
      eventToBlocks. Let me look at that logic again:

        Read src/components/EventDisplay.tsx

      Ah! I see the problem now. In the test, we're providing a single event with one message containing 3
       text blocks. EventDisplay keeps the text blocks separate in uniqueContent (lines 36-54), so they
      stay as 3 separate blocks before being passed to eventToBlocks. Then eventToBlocks merges them. But
      there's still the Box with gap={1} that creates spacing.

      Wait, actually looking at the logic again - eventToBlocks should merge them, and return a single
      ContentBlock. Then that single block gets rendered as a single <StreamingText> component. So there
      should be no gaps.

      Let me add some logging to see what's actually happening. But actually, I think the problem is that
      the test is checking for newlines in the output. Ink's Box with flexDirection="column" adds newlines
       between elements. So even if I have 1 StreamingText, the Box might still add newlines around it.

      Actually wait - if eventToBlocks returns 1 block, then there's only 1 child in the Box, so there
      should be no gaps. Let me trace through more carefully what the test is doing:

      In the test, we render <EventDisplay events={[...]} />. The EventDisplay:
      1. Filters to assistant messages
      2. Merges by message ID (only 1 message)
      3. Deduplicates (all 3 text blocks are unique)
      4. Calls eventToBlocks on the merged event
      5. eventToBlocks should merge the 3 text blocks into 1
      6. Renders the blocks

      Let me print what lastFrame() actually returns by modifying the test temporarily:

        Edit src/components/EventDisplay.test.tsx

        $ pnpm test EventDisplay.test.tsx 2>&1 | grep -A 20 "merges consecutive"

      Aha! The output is "Use the\\n\\nconsole.log()\\n\\n function to debug." - there are TWO newlines
      between each part! This tells me that the 3 text blocks are NOT being merged by eventToBlocks.
      They're still coming through as 3 separate parts.

      This means the EventDisplay deduplication logic is keeping them separate, OR there's a bug in my
      eventToBlocks implementation. Let me add logging to eventToBlocks to see:

        Edit src/components/eventToBlocks.ts

        $ pnpm test EventDisplay.test.tsx 2>&1 | grep -A 30 "eventToBlocks content"

      Perfect! So eventToBlocks IS receiving the 3 separate text blocks:
      json
      [
        { "type": "text", "text": "Use the " },
        { "type": "text", "text": "console.log()" },
        { "type": "text", "text": " function to debug." }
      ]


      But the output still shows them on 3 separate lines. This means my merging logic isn't working. Let
      me add more logging to see what's happening in the loop:

        Edit src/components/eventToBlocks.ts

        Edit src/components/eventToBlocks.ts

        $ pnpm test EventDisplay.test.tsx 2>&1 | grep -A 50 "merges consecutive text blocks to prevent
      unwanted gaps"

      EXCELLENT! The merging IS working correctly:
      - eventToBlocks returns: [{ "type": "text", "content": "Use the console.log() function to debug.",
      "id": "msg_123-0" }]

      But the output is still: "Use the\\n\\nconsole.log()\\n\\n function to debug."

      This means the problem is in how StreamingText is rendering! The backticks in the merged text are
      being split up by StreamingText's markdown processing. Let me check the StreamingText component
      logic again - it must be detecting the backticks and rendering them as separate Text components, and
       those are getting newlines between them!

      Oh wait, I see it now! Look at EventDisplay:69-76:

      tsx
      <Box flexDirection="column" gap={1}>
        {contentBlocks.map(block =>
          block.type === "text" ?
            <StreamingText key={block.id} content={block.content} />
          : <ToolUse key={block.id} name={block.name} arg={block.arg} />,
        )}
      </Box>


      The Box has gap={1}, which adds gaps between CHILDREN. StreamingText renders multiple <Text>
      components (one for each formatted segment), and those become CHILDREN of the parent, not siblings.
      Wait, no - StreamingText returns a fragment <>...</> containing multiple Text components.

      Actually, I think the issue is that Ink is rendering the separate Text components with gaps. Let me
      check StreamingText more carefully - it returns a fragment with separate Text components. Those Text
       components might be getting wrapped or treated differently by Ink.

      Actually, I think the real fix is to render StreamingText as inline, not in a column layout. But
      wait, the Box flexDirection="column" affects the layout of contentBlocks (Text vs ToolUse), not the
      internal layout of StreamingText.

      Let me check if the problem is in how StreamingText uses fragments. When you return a fragment with
      multiple <Text> components in Ink, they might be rendered on separate lines. Let me check:

        Read src/components/StreamingText.tsx

      The issue is that StreamingText returns a fragment with multiple <Text> components. In Ink, these
      might be rendered as separate blocks. The fix is to wrap them in a single <Text> component or use
      the <Text wrap="wrap"> with inline rendering.

      Let me look at how Ink handles multiple Text components. Actually, the fix is simple - wrap all the
      text parts in a single Box or Text component with inline rendering:

        Edit src/components/StreamingText.tsx

        Edit src/components/StreamingText.tsx

      Now let me remove the console.log statements and test:

        Edit src/components/eventToBlocks.ts

        Edit src/components/eventToBlocks.ts

        Edit src/components/EventDisplay.test.tsx

      Now let me run all tests:

        $ pnpm test

      Perfect! All tests pass now. Let me verify the build still works:

        $ pnpm build

      Excellent! Now let me update the todo list and progress file, then commit:

        Read .ralph/todo.md

        Edit .ralph/todo.md

        Read .ralph/progress.md

        Edit .ralph/progress.md

      Now let me format the code with Prettier:

        $ pnpm format

      Good! Now let me commit all these changes:

        $ git add -A && git diff --cached --stat

        $ git commit -m "$(cat <<'EOF'
      Fix inline code blocks appearing in separate paragraphs

      - Modified eventToBlocks.ts to merge consecutive text blocks using a textBuffer
      - Wrapped StreamingText content in Box component for proper inline rendering
      - Added test case to verify consecutive text blocks are merged
      - Updated existing tests to reflect new merging behavior

      Fixes issue where inline code like \`console.log()\` was rendered on separate
      lines with gaps instead of flowing inline with surrounding text.

      Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
      EOF
      )"

      Perfect! Let me verify git status:

        $ git status
      "
    `)
  })
})

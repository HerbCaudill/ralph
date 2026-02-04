/**
 * Test fixtures for TaskChatController event replay testing.
 *
 * These fixtures contain realistic event sequences captured from actual usage,
 * used to test the TaskChatController's rendering of various scenarios.
 */

/**
 * Base event shape with required fields for task chat events.
 */
export interface TaskChatEventBase {
  /** Event type identifier */
  type: string
  /** Timestamp when the event occurred */
  timestamp: number
  /** Additional properties */
  [key: string]: unknown
}

/**
 * Entry in the task chat event log.
 * Each entry represents a logged event with metadata.
 */
export interface TaskChatLogEntry {
  /** Session ID this event belongs to */
  sessionId: string
  /** ISO timestamp when this event was logged */
  loggedAt: string
  /** The actual event data */
  event: TaskChatEventBase
}

/**  Fixture metadata for test organization. */
export interface FixtureMetadata {
  /** Human-readable name for the fixture */
  name: string
  /** Description of what this fixture tests */
  description: string
  /** Expected behavior notes */
  expectedBehavior?: string
}

/**  A complete fixture with metadata and events. */
export interface TaskChatFixture {
  metadata: FixtureMetadata
  entries: TaskChatLogEntry[]
}

// Simple Q&A Conversation Fixture

/**
 * Simple Q&A conversation: user asks a question, assistant responds with text.
 * No tool use involved.
 */
export const simpleQAFixture: TaskChatFixture = {
  metadata: {
    name: "Simple Q&A",
    description: "Basic conversation with user question and assistant text response",
    expectedBehavior: "Should render user bubble followed by assistant bubble with markdown",
  },
  entries: [
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.000Z",
      event: {
        type: "user",
        timestamp: 1737540000000,
        message: {
          role: "user",
          content: "What are my highest priority tasks?",
        },
      },
    },
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737540000100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737540000150,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Your highest priority tasks are:\n\n" },
        },
      },
    },
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737540000200,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "1. **Fix login bug** (P1)\n" },
        },
      },
    },
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.250Z",
      event: {
        type: "stream_event",
        timestamp: 1737540000250,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "2. **Implement search** (P1)\n" },
        },
      },
    },
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.300Z",
      event: {
        type: "stream_event",
        timestamp: 1737540000300,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "3. **Update docs** (P2)" },
        },
      },
    },
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.350Z",
      event: {
        type: "stream_event",
        timestamp: 1737540000350,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.400Z",
      event: {
        type: "assistant",
        timestamp: 1737540000400,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Your highest priority tasks are:\n\n1. **Fix login bug** (P1)\n2. **Implement search** (P1)\n3. **Update docs** (P2)",
            },
          ],
        },
      },
    },
    {
      sessionId: "test0001",
      loggedAt: "2026-01-22T10:00:00.450Z",
      event: {
        type: "result",
        timestamp: 1737540000450,
        result:
          "Your highest priority tasks are:\n\n1. **Fix login bug** (P1)\n2. **Implement search** (P1)\n3. **Update docs** (P2)",
      },
    },
  ],
}

// Tool Use with Success Fixture

/**  Tool use scenario: assistant uses Bash tool to run a command successfully. */
export const toolUseSuccessFixture: TaskChatFixture = {
  metadata: {
    name: "Tool Use Success",
    description: "Assistant uses Bash tool to list tasks, gets successful result",
    expectedBehavior:
      "Should show tool use card with Bash command, then tool result, then assistant response",
  },
  entries: [
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:00.000Z",
      event: {
        type: "user",
        timestamp: 1737543600000,
        message: {
          role: "user",
          content: "Show me the open tasks",
        },
      },
    },
    // Tool use starts
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:00.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737543600100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "tool_use",
            id: "toolu_01ABC123",
            name: "Bash",
          },
        },
      },
    },
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:00.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737543600150,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "input_json_delta",
            partial_json: '{"command": "bd list --status=open"}',
          },
        },
      },
    },
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:00.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737543600200,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    // Complete assistant message with tool use
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:00.250Z",
      event: {
        type: "assistant",
        timestamp: 1737543600250,
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_01ABC123",
              name: "Bash",
              input: { command: "bd list --status=open" },
            },
          ],
        },
      },
    },
    // Tool result
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:01.000Z",
      event: {
        type: "user",
        timestamp: 1737543601000,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_01ABC123",
              content:
                "r-abc1 Fix login bug (P1)\nr-abc2 Implement search (P1)\nr-abc3 Update docs (P2)",
            },
          ],
        },
      },
    },
    // Final assistant response
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:01.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737543601100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:01.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737543601150,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "text_delta",
            text: "Here are the open tasks:\n\n- **r-abc1**: Fix login bug (P1)\n- **r-abc2**: Implement search (P1)\n- **r-abc3**: Update docs (P2)",
          },
        },
      },
    },
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:01.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737543601200,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:01.250Z",
      event: {
        type: "assistant",
        timestamp: 1737543601250,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Here are the open tasks:\n\n- **r-abc1**: Fix login bug (P1)\n- **r-abc2**: Implement search (P1)\n- **r-abc3**: Update docs (P2)",
            },
          ],
        },
      },
    },
    {
      sessionId: "test0002",
      loggedAt: "2026-01-22T11:00:01.300Z",
      event: {
        type: "result",
        timestamp: 1737543601300,
        result:
          "Here are the open tasks:\n\n- **r-abc1**: Fix login bug (P1)\n- **r-abc2**: Implement search (P1)\n- **r-abc3**: Update docs (P2)",
      },
    },
  ],
}

// Multiple Rapid Events (Streaming) Fixture

/**  Multiple rapid streaming events simulating real-time text generation. */
export const rapidStreamingFixture: TaskChatFixture = {
  metadata: {
    name: "Rapid Streaming",
    description: "Multiple rapid content_block_delta events simulating fast streaming",
    expectedBehavior: "Should accumulate text smoothly without gaps or duplicates",
  },
  entries: [
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.000Z",
      event: {
        type: "user",
        timestamp: 1737547200000,
        message: {
          role: "user",
          content: "Explain task priorities",
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.050Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200050,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    // Rapid sequence of deltas (10-20ms apart, simulating fast streaming)
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.060Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200060,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Task " },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.075Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200075,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "priorities " },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.090Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200090,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "help " },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.105Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200105,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "you " },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.120Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200120,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "focus " },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.135Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200135,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "on " },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200150,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "what's " },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.165Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200165,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "most " },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.180Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200180,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "important." },
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737547200200,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.250Z",
      event: {
        type: "assistant",
        timestamp: 1737547200250,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Task priorities help you focus on what's most important.",
            },
          ],
        },
      },
    },
    {
      sessionId: "test0003",
      loggedAt: "2026-01-22T12:00:00.300Z",
      event: {
        type: "result",
        timestamp: 1737547200300,
        result: "Task priorities help you focus on what's most important.",
      },
    },
  ],
}

// Out-of-Order Events Fixture

/**
 * Events that arrive out of order (by timestamp) to test sorting behavior.
 * This can happen due to network latency or async processing.
 */
export const outOfOrderFixture: TaskChatFixture = {
  metadata: {
    name: "Out of Order Events",
    description: "Events logged in non-chronological order to test timestamp-based sorting",
    expectedBehavior: "Should display events in timestamp order, not arrival order",
  },
  entries: [
    // Logged at :100 but timestamp is :050 (arrived late)
    {
      sessionId: "test0004",
      loggedAt: "2026-01-22T13:00:00.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737550800050,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    // Logged first but timestamp is :000
    {
      sessionId: "test0004",
      loggedAt: "2026-01-22T13:00:00.000Z",
      event: {
        type: "user",
        timestamp: 1737550800000,
        message: {
          role: "user",
          content: "Hello",
        },
      },
    },
    // Logged at :200 but timestamp is :100
    {
      sessionId: "test0004",
      loggedAt: "2026-01-22T13:00:00.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737550800100,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello! How can I help?" },
        },
      },
    },
    // These arrive in order
    {
      sessionId: "test0004",
      loggedAt: "2026-01-22T13:00:00.300Z",
      event: {
        type: "stream_event",
        timestamp: 1737550800150,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    {
      sessionId: "test0004",
      loggedAt: "2026-01-22T13:00:00.400Z",
      event: {
        type: "assistant",
        timestamp: 1737550800200,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Hello! How can I help?",
            },
          ],
        },
      },
    },
    {
      sessionId: "test0004",
      loggedAt: "2026-01-22T13:00:00.450Z",
      event: {
        type: "result",
        timestamp: 1737550800250,
        result: "Hello! How can I help?",
      },
    },
  ],
}

// Multiple Tool Uses Fixture

/**  Multiple tool uses in a single turn (Read, then Grep). */
export const multipleToolUsesFixture: TaskChatFixture = {
  metadata: {
    name: "Multiple Tool Uses",
    description: "Assistant uses multiple tools (Read, Grep) in sequence within one turn",
    expectedBehavior: "Should show both tool use cards in order with results",
  },
  entries: [
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:00.000Z",
      event: {
        type: "user",
        timestamp: 1737554400000,
        message: {
          role: "user",
          content: "Find TODO comments in the codebase",
        },
      },
    },
    // First tool: Read
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:00.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737554400100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "tool_use",
            id: "toolu_read_01",
            name: "Read",
          },
        },
      },
    },
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:00.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737554400150,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    // Second tool: Grep
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:00.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737554400200,
        event: {
          type: "content_block_start",
          index: 1,
          content_block: {
            type: "tool_use",
            id: "toolu_grep_01",
            name: "Grep",
          },
        },
      },
    },
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:00.250Z",
      event: {
        type: "stream_event",
        timestamp: 1737554400250,
        event: {
          type: "content_block_stop",
          index: 1,
        },
      },
    },
    // Complete assistant message with both tools
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:00.300Z",
      event: {
        type: "assistant",
        timestamp: 1737554400300,
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_read_01",
              name: "Read",
              input: { file_path: "/project/CLAUDE.md" },
            },
            {
              type: "tool_use",
              id: "toolu_grep_01",
              name: "Grep",
              input: { pattern: "TODO", path: "/project/src" },
            },
          ],
        },
      },
    },
    // Tool results for both
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:01.000Z",
      event: {
        type: "user",
        timestamp: 1737554401000,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_read_01",
              content: "# CLAUDE.md\n\nProject documentation...",
            },
            {
              type: "tool_result",
              tool_use_id: "toolu_grep_01",
              content:
                "src/app.ts:42: // TODO: Add error handling\nsrc/utils.ts:15: // TODO: Optimize",
            },
          ],
        },
      },
    },
    // Final response
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:01.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737554401100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:01.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737554401150,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "text_delta",
            text: "I found 2 TODO comments:\n\n1. `src/app.ts:42` - Add error handling\n2. `src/utils.ts:15` - Optimize",
          },
        },
      },
    },
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:01.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737554401200,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:01.250Z",
      event: {
        type: "assistant",
        timestamp: 1737554401250,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "I found 2 TODO comments:\n\n1. `src/app.ts:42` - Add error handling\n2. `src/utils.ts:15` - Optimize",
            },
          ],
        },
      },
    },
    {
      sessionId: "test0005",
      loggedAt: "2026-01-22T14:00:01.300Z",
      event: {
        type: "result",
        timestamp: 1737554401300,
        result:
          "I found 2 TODO comments:\n\n1. `src/app.ts:42` - Add error handling\n2. `src/utils.ts:15` - Optimize",
      },
    },
  ],
}

// Tool Use Error Fixture

/**  Tool use that results in an error. */
export const toolUseErrorFixture: TaskChatFixture = {
  metadata: {
    name: "Tool Use Error",
    description: "Tool use that fails with an error response",
    expectedBehavior: "Should show tool use card with error status",
  },
  entries: [
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.000Z",
      event: {
        type: "user",
        timestamp: 1737558000000,
        message: {
          role: "user",
          content: "Read the config file",
        },
      },
    },
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737558000100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "tool_use",
            id: "toolu_error_01",
            name: "Read",
          },
        },
      },
    },
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737558000150,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.200Z",
      event: {
        type: "assistant",
        timestamp: 1737558000200,
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_error_01",
              name: "Read",
              input: { file_path: "/nonexistent/config.json" },
            },
          ],
        },
      },
    },
    // Tool result with error
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.500Z",
      event: {
        type: "user",
        timestamp: 1737558000500,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_error_01",
              is_error: true,
              content: "Error: ENOENT: no such file or directory, open '/nonexistent/config.json'",
            },
          ],
        },
      },
    },
    // Assistant handles the error gracefully
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.600Z",
      event: {
        type: "stream_event",
        timestamp: 1737558000600,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.650Z",
      event: {
        type: "stream_event",
        timestamp: 1737558000650,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "text_delta",
            text: "I couldn't find the config file at that path. Could you provide the correct path?",
          },
        },
      },
    },
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.700Z",
      event: {
        type: "stream_event",
        timestamp: 1737558000700,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.750Z",
      event: {
        type: "assistant",
        timestamp: 1737558000750,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "I couldn't find the config file at that path. Could you provide the correct path?",
            },
          ],
        },
      },
    },
    {
      sessionId: "test0006",
      loggedAt: "2026-01-22T15:00:00.800Z",
      event: {
        type: "result",
        timestamp: 1737558000800,
        result: "I couldn't find the config file at that path. Could you provide the correct path?",
      },
    },
  ],
}

// Full Streaming with Deduplication Fixture

/**
 * Full streaming scenario with message_start/message_stop that tests deduplication.
 * This represents the real event flow from the SDK which sends both streaming events
 * AND a final assistant event. The hook should deduplicate to avoid rendering twice.
 */
export const fullStreamingFixture: TaskChatFixture = {
  metadata: {
    name: "Full Streaming with Deduplication",
    description:
      "Complete streaming flow with message_start/stop AND assistant event - tests deduplication",
    expectedBehavior:
      "Should render content only once, not duplicated from streaming and assistant",
  },
  entries: [
    {
      sessionId: "test0007",
      loggedAt: "2026-01-22T16:00:00.000Z",
      event: {
        type: "user",
        timestamp: 1737561600000,
        message: {
          role: "user",
          content: "Hello",
        },
      },
    },
    // message_start begins the streaming message
    {
      sessionId: "test0007",
      loggedAt: "2026-01-22T16:00:00.050Z",
      event: {
        type: "stream_event",
        timestamp: 1737561600050,
        event: {
          type: "message_start",
          message: { role: "assistant" },
        },
      },
    },
    {
      sessionId: "test0007",
      loggedAt: "2026-01-22T16:00:00.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737561600100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    {
      sessionId: "test0007",
      loggedAt: "2026-01-22T16:00:00.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737561600150,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hi there! How can I help you today?" },
        },
      },
    },
    {
      sessionId: "test0007",
      loggedAt: "2026-01-22T16:00:00.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737561600200,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    // message_stop ends the streaming - hook synthesizes assistant event here
    {
      sessionId: "test0007",
      loggedAt: "2026-01-22T16:00:00.250Z",
      event: {
        type: "stream_event",
        timestamp: 1737561600250,
        event: {
          type: "message_stop",
        },
      },
    },
    // Server also sends assistant event - this should be deduplicated
    {
      sessionId: "test0007",
      loggedAt: "2026-01-22T16:00:00.300Z",
      event: {
        type: "assistant",
        timestamp: 1737561600300,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Hi there! How can I help you today?",
            },
          ],
        },
      },
    },
    {
      sessionId: "test0007",
      loggedAt: "2026-01-22T16:00:00.350Z",
      event: {
        type: "result",
        timestamp: 1737561600350,
        result: "Hi there! How can I help you today?",
      },
    },
  ],
}

// Multi-Tool Full Streaming Fixture (Issue r-3mjn reproduction)

/**
 * Full streaming scenario with multiple tool uses and message_start/message_stop.
 * This reproduces the exact scenario from issue r-3mjn where the first response
 * was being duplicated (text + tool uses appearing twice).
 *
 * The sequence is:
 * 1. User asks "how many tasks"
 * 2. Claude responds with text + 3 Bash tool uses
 * 3. Tools run, results come back
 * 4. Claude gives final summary
 *
 * Without proper deduplication, Turn 1's content would appear twice.
 */
export const multiToolFullStreamingFixture: TaskChatFixture = {
  metadata: {
    name: "Multi-Tool Full Streaming",
    description: "Multiple tool uses with full streaming - reproduces r-3mjn duplication bug",
    expectedBehavior: "Each tool use should appear exactly once, not duplicated",
  },
  entries: [
    // Turn 1: User message + Claude's response with 3 tool uses
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.000Z",
      event: {
        type: "user",
        timestamp: 1737626400000,
        message: {
          role: "user",
          content: "how many tasks do i have",
        },
      },
    },
    // message_start for turn 1
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.050Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400050,
        event: {
          type: "message_start",
          message: { role: "assistant" },
        },
      },
    },
    // Text: "Let me check"
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.120Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400120,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Let me check your current task counts." },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.140Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400140,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    // Tool use 1: Bash (open tasks)
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.160Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400160,
        event: {
          type: "content_block_start",
          index: 1,
          content_block: { type: "tool_use", id: "toolu_open", name: "Bash" },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.180Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400180,
        event: {
          type: "content_block_delta",
          index: 1,
          delta: {
            type: "input_json_delta",
            partial_json: '{"command":"bd list --status=open | wc -l"}',
          },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400200,
        event: {
          type: "content_block_stop",
          index: 1,
        },
      },
    },
    // Tool use 2: Bash (in_progress tasks)
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.220Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400220,
        event: {
          type: "content_block_start",
          index: 2,
          content_block: { type: "tool_use", id: "toolu_progress", name: "Bash" },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.240Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400240,
        event: {
          type: "content_block_delta",
          index: 2,
          delta: {
            type: "input_json_delta",
            partial_json: '{"command":"bd list --status=in_progress | wc -l"}',
          },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.260Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400260,
        event: {
          type: "content_block_stop",
          index: 2,
        },
      },
    },
    // Tool use 3: Bash (blocked tasks)
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.280Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400280,
        event: {
          type: "content_block_start",
          index: 3,
          content_block: { type: "tool_use", id: "toolu_blocked", name: "Bash" },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.300Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400300,
        event: {
          type: "content_block_delta",
          index: 3,
          delta: {
            type: "input_json_delta",
            partial_json: '{"command":"bd list --status=blocked | wc -l"}',
          },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.320Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400320,
        event: {
          type: "content_block_stop",
          index: 3,
        },
      },
    },
    // message_stop for turn 1
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.340Z",
      event: {
        type: "stream_event",
        timestamp: 1737626400340,
        event: {
          type: "message_stop",
        },
      },
    },
    // Complete assistant message for turn 1 (should be deduplicated)
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:00.360Z",
      event: {
        type: "assistant",
        timestamp: 1737626400360,
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check your current task counts." },
            {
              type: "tool_use",
              id: "toolu_open",
              name: "Bash",
              input: { command: "bd list --status=open | wc -l" },
            },
            {
              type: "tool_use",
              id: "toolu_progress",
              name: "Bash",
              input: { command: "bd list --status=in_progress | wc -l" },
            },
            {
              type: "tool_use",
              id: "toolu_blocked",
              name: "Bash",
              input: { command: "bd list --status=blocked | wc -l" },
            },
          ],
        },
      },
    },
    // Tool results
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:01.000Z",
      event: {
        type: "user",
        timestamp: 1737626401000,
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "toolu_open", content: "27" },
            { type: "tool_result", tool_use_id: "toolu_progress", content: "0" },
            { type: "tool_result", tool_use_id: "toolu_blocked", content: "0" },
          ],
        },
      },
    },
    // Turn 2: Final response
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:01.050Z",
      event: {
        type: "stream_event",
        timestamp: 1737626401050,
        event: {
          type: "message_start",
          message: { role: "assistant" },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:01.100Z",
      event: {
        type: "stream_event",
        timestamp: 1737626401100,
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:01.150Z",
      event: {
        type: "stream_event",
        timestamp: 1737626401150,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "text_delta",
            text: "You have 27 open tasks, with 0 in progress and 0 blocked.",
          },
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:01.200Z",
      event: {
        type: "stream_event",
        timestamp: 1737626401200,
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:01.250Z",
      event: {
        type: "stream_event",
        timestamp: 1737626401250,
        event: {
          type: "message_stop",
        },
      },
    },
    // Complete assistant message for turn 2 (should be deduplicated)
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:01.300Z",
      event: {
        type: "assistant",
        timestamp: 1737626401300,
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "You have 27 open tasks, with 0 in progress and 0 blocked." },
          ],
        },
      },
    },
    {
      sessionId: "test0008",
      loggedAt: "2026-01-23T10:00:01.350Z",
      event: {
        type: "result",
        timestamp: 1737626401350,
        result: "You have 27 open tasks, with 0 in progress and 0 blocked.",
      },
    },
  ],
}

// Helper Functions

/**  Get all available fixtures. */
export function getAllFixtures(): TaskChatFixture[] {
  return [
    simpleQAFixture,
    toolUseSuccessFixture,
    rapidStreamingFixture,
    outOfOrderFixture,
    multipleToolUsesFixture,
    toolUseErrorFixture,
    fullStreamingFixture,
    multiToolFullStreamingFixture,
  ]
}

/**  Get a fixture by name. */
export function getFixtureByName(name: string): TaskChatFixture | undefined {
  return getAllFixtures().find(f => f.metadata.name === name)
}

/**  Extract just the events from fixture entries (without log metadata). */
export function extractEvents(
  entries: TaskChatLogEntry[],
): Array<{ type: string; timestamp: number; [key: string]: unknown }> {
  return entries.map(entry => entry.event)
}

/**  Sort events by timestamp (useful for testing out-of-order scenarios). */
export function sortEventsByTimestamp<T extends { timestamp: number }>(events: T[]): T[] {
  return [...events].sort((a, b) => a.timestamp - b.timestamp)
}

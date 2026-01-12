import { describe, it, expect } from "vitest"
import { eventToBlocks } from "./eventToBlocks.js"

describe("eventToBlocks", () => {
  it("returns empty array for non-assistant events", () => {
    const event = { type: "message_start" }
    const result = eventToBlocks(event)
    expect(result).toEqual([])
  })

  it("returns empty array for assistant event without message", () => {
    const event = { type: "assistant" }
    const result = eventToBlocks(event)
    expect(result).toEqual([])
  })

  it("returns empty array for assistant event without content", () => {
    const event = { type: "assistant", message: {} }
    const result = eventToBlocks(event)
    expect(result).toEqual([])
  })

  it("extracts text blocks", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [{ type: "text", text: "Hello world" }],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "text", content: "Hello world", id: "msg_123-0" }])
  })

  it("extracts multiple text blocks", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          { type: "text", text: "First" },
          { type: "text", text: "Second" },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([
      { type: "text", content: "First", id: "msg_123-0" },
      { type: "text", content: "Second", id: "msg_123-1" },
    ])
  })

  it("extracts Read tool use with relative path", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Read",
            input: { file_path: `${process.cwd()}/src/index.ts` },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "Read", arg: "src/index.ts", id: "msg_123-0" }])
  })

  it("extracts Edit tool use", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Edit",
            input: { file_path: `${process.cwd()}/src/app.ts` },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "Edit", arg: "src/app.ts", id: "msg_123-0" }])
  })

  it("extracts Write tool use", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: { file_path: `${process.cwd()}/src/new.ts` },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "Write", arg: "src/new.ts", id: "msg_123-0" }])
  })

  it("extracts Bash tool use with shortened temp paths", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Bash",
            input: { command: "cat /tmp/temp-file.txt" },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "$", arg: "cat temp-file.txt", id: "msg_123-0" }])
  })

  it("extracts Grep tool use with pattern only", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Grep",
            input: { pattern: "search-term" },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "Grep", arg: "search-term", id: "msg_123-0" }])
  })

  it("extracts Grep tool use with pattern and path", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Grep",
            input: { pattern: "TODO", path: `${process.cwd()}/src` },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "Grep", arg: "TODO in src", id: "msg_123-0" }])
  })

  it("extracts Glob tool use with pattern only", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Glob",
            input: { pattern: "**/*.ts" },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "Glob", arg: "**/*.ts", id: "msg_123-0" }])
  })

  it("extracts Glob tool use with pattern and path", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Glob",
            input: { pattern: "*.json", path: `${process.cwd()}/config` },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([
      { type: "tool", name: "Glob", arg: "*.json in config", id: "msg_123-0" },
    ])
  })

  it("extracts TodoWrite with todos", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "TodoWrite",
            input: {
              todos: [
                { content: "Task 1", status: "pending" },
                { content: "Task 2", status: "in_progress" },
                { content: "Task 3", status: "completed" },
              ],
            },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([
      {
        type: "tool",
        name: "TodoWrite",
        arg: "\n    [ ] Task 1\n    [~] Task 2\n    [x] Task 3",
        id: "msg_123-0",
      },
    ])
  })

  it("extracts TodoWrite without todos", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "TodoWrite",
            input: { todos: [] },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "TodoWrite", id: "msg_123-0" }])
  })

  it("extracts WebFetch tool use", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "WebFetch",
            input: { url: "https://example.com" },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([
      {
        type: "tool",
        name: "WebFetch",
        arg: "https://example.com",
        id: "msg_123-0",
      },
    ])
  })

  it("extracts WebSearch tool use", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "WebSearch",
            input: { query: "test query" },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([
      {
        type: "tool",
        name: "WebSearch",
        arg: "test query",
        id: "msg_123-0",
      },
    ])
  })

  it("extracts Task tool use", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Task",
            input: { description: "Run tests" },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "Task", arg: "Run tests", id: "msg_123-0" }])
  })

  it("extracts Skill tool use", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "Skill",
            input: { skill: "commit" },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([{ type: "tool", name: "Skill", arg: "commit", id: "msg_123-0" }])
  })

  it("ignores unknown tool types", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          {
            type: "tool_use",
            name: "UnknownTool",
            input: { foo: "bar" },
          },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([])
  })

  it("handles mixed content types", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          { type: "text", text: "Let me read a file" },
          {
            type: "tool_use",
            name: "Read",
            input: { file_path: `${process.cwd()}/src/index.ts` },
          },
          { type: "text", text: "Done reading" },
        ],
      },
    }
    const result = eventToBlocks(event)
    expect(result).toEqual([
      { type: "text", content: "Let me read a file", id: "msg_123-0" },
      { type: "tool", name: "Read", arg: "src/index.ts", id: "msg_123-1" },
      { type: "text", content: "Done reading", id: "msg_123-2" },
    ])
  })

  it("generates unique IDs for each block", () => {
    const event = {
      type: "assistant",
      message: {
        id: "msg_123",
        content: [
          { type: "text", text: "First" },
          { type: "text", text: "Second" },
          { type: "text", text: "Third" },
        ],
      },
    }
    const result = eventToBlocks(event)
    const ids = result.map(block => block.id)
    expect(ids).toEqual(["msg_123-0", "msg_123-1", "msg_123-2"])
    expect(new Set(ids).size).toBe(3) // All unique
  })

  it('uses "unknown" ID when message has no ID', () => {
    const event = {
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Hello" }],
      },
    }
    const result = eventToBlocks(event)
    expect(result[0].id).toBe("unknown-0")
  })
})

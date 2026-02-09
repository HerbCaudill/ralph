import { describe, it, expect } from "vitest"
import { getToolSummary } from ".././getToolSummary"

describe("getToolSummary", () => {
  describe("file operations", () => {
    it("should return relative path for Read tool", () => {
      const input = { file_path: "/Users/test/project/src/file.ts" }
      const result = getToolSummary("Read", input, "/Users/test/project")
      expect(result).toBe("src/file.ts")
    })

    it("should return relative path for Edit tool", () => {
      const input = { file_path: "/Users/test/project/src/file.ts" }
      const result = getToolSummary("Edit", input, "/Users/test/project")
      expect(result).toBe("src/file.ts")
    })

    it("should return relative path for Write tool", () => {
      const input = { file_path: "/Users/test/project/src/file.ts" }
      const result = getToolSummary("Write", input, "/Users/test/project")
      expect(result).toBe("src/file.ts")
    })

    it("should return absolute path when workspace is null", () => {
      const input = { file_path: "/Users/test/project/src/file.ts" }
      const result = getToolSummary("Read", input, null)
      expect(result).toBe("/Users/test/project/src/file.ts")
    })

    it("should return empty string when file_path is missing", () => {
      const result = getToolSummary("Read", {}, "/Users/test/project")
      expect(result).toBe("")
    })
  })

  describe("command tools", () => {
    it("should return command for Bash tool", () => {
      const input = { command: "npm test" }
      const result = getToolSummary("Bash", input)
      expect(result).toBe("npm test")
    })

    it("should return empty string when command is missing", () => {
      const result = getToolSummary("Bash", {})
      expect(result).toBe("")
    })

    it("should handle multiline commands", () => {
      const input = { command: "npm install &&\nnpm test" }
      const result = getToolSummary("Bash", input)
      expect(result).toBe("npm install &&\nnpm test")
    })

    it("should return command when input is a JSON string", () => {
      const input = '{"command":"pnpm test:all"}' as unknown as Record<string, unknown>
      const result = getToolSummary("Bash", input)
      expect(result).toBe("pnpm test:all")
    })
  })

  describe("search tools", () => {
    it("should return pattern for Grep tool", () => {
      const input = { pattern: "TODO" }
      const result = getToolSummary("Grep", input)
      expect(result).toBe("TODO")
    })

    it("should return pattern for Glob tool", () => {
      const input = { pattern: "**/*.ts" }
      const result = getToolSummary("Glob", input)
      expect(result).toBe("**/*.ts")
    })

    it("should return empty string when pattern is missing", () => {
      const result = getToolSummary("Grep", {})
      expect(result).toBe("")
    })
  })

  describe("web tools", () => {
    it("should return query for WebSearch tool", () => {
      const input = { query: "typescript best practices" }
      const result = getToolSummary("WebSearch", input)
      expect(result).toBe("typescript best practices")
    })

    it("should return url for WebFetch tool", () => {
      const input = { url: "https://example.com" }
      const result = getToolSummary("WebFetch", input)
      expect(result).toBe("https://example.com")
    })

    it("should return empty string when query is missing", () => {
      const result = getToolSummary("WebSearch", {})
      expect(result).toBe("")
    })
  })

  describe("todo tool", () => {
    it("should return count for TodoWrite tool with array", () => {
      const input = { todos: ["Task 1", "Task 2", "Task 3"] }
      const result = getToolSummary("TodoWrite", input)
      expect(result).toBe("3 todo(s)")
    })

    it("should handle single todo", () => {
      const input = { todos: ["Task 1"] }
      const result = getToolSummary("TodoWrite", input)
      expect(result).toBe("1 todo(s)")
    })

    it("should handle empty todos array", () => {
      const input = { todos: [] }
      const result = getToolSummary("TodoWrite", input)
      expect(result).toBe("0 todo(s)")
    })

    it("should return empty string when todos is not an array", () => {
      const input = { todos: "not an array" }
      const result = getToolSummary("TodoWrite", input)
      expect(result).toBe("")
    })

    it("should return empty string when todos is missing", () => {
      const result = getToolSummary("TodoWrite", {})
      expect(result).toBe("")
    })
  })

  describe("task tool", () => {
    it("should return description for Task tool", () => {
      const input = { description: "Fix bug in login" }
      const result = getToolSummary("Task", input)
      expect(result).toBe("Fix bug in login")
    })

    it("should return empty string when description is missing", () => {
      const result = getToolSummary("Task", {})
      expect(result).toBe("")
    })
  })

  describe("case-insensitive tool names (Codex adapter emits lowercase)", () => {
    it("should return command for lowercase 'bash'", () => {
      const input = { command: "/bin/zsh -lc 'pnpm test:all'" }
      const result = getToolSummary("bash", input)
      expect(result).toBe("/bin/zsh -lc 'pnpm test:all'")
    })

    it("should return file path for lowercase 'read'", () => {
      const input = { file_path: "/Users/test/project/src/file.ts" }
      const result = getToolSummary("read", input, "/Users/test/project")
      expect(result).toBe("src/file.ts")
    })

    it("should return file path for lowercase 'edit'", () => {
      const input = { file_path: "/Users/test/project/src/file.ts" }
      const result = getToolSummary("edit", input, "/Users/test/project")
      expect(result).toBe("src/file.ts")
    })

    it("should return file path for lowercase 'write'", () => {
      const input = { file_path: "/Users/test/project/src/file.ts" }
      const result = getToolSummary("write", input, "/Users/test/project")
      expect(result).toBe("src/file.ts")
    })

    it("should return pattern for lowercase 'grep'", () => {
      const input = { pattern: "TODO" }
      const result = getToolSummary("grep", input)
      expect(result).toBe("TODO")
    })

    it("should return pattern for lowercase 'glob'", () => {
      const input = { pattern: "**/*.ts" }
      const result = getToolSummary("glob", input)
      expect(result).toBe("**/*.ts")
    })

    it("should return query for lowercase 'websearch'", () => {
      const input = { query: "typescript best practices" }
      const result = getToolSummary("websearch", input)
      expect(result).toBe("typescript best practices")
    })

    it("should return url for lowercase 'webfetch'", () => {
      const input = { url: "https://example.com" }
      const result = getToolSummary("webfetch", input)
      expect(result).toBe("https://example.com")
    })

    it("should return count for lowercase 'todowrite'", () => {
      const input = { todos: ["Task 1", "Task 2"] }
      const result = getToolSummary("todowrite", input)
      expect(result).toBe("2 todo(s)")
    })

    it("should return description for lowercase 'task'", () => {
      const input = { description: "Fix bug in login" }
      const result = getToolSummary("task", input)
      expect(result).toBe("Fix bug in login")
    })

    it("should handle UPPERCASE tool names", () => {
      const input = { command: "npm test" }
      const result = getToolSummary("BASH", input)
      expect(result).toBe("npm test")
    })
  })

  describe("edge cases", () => {
    it("should return empty string when input is undefined", () => {
      const result = getToolSummary("Read", undefined)
      expect(result).toBe("")
    })

    it("should handle non-string values by coercing to string", () => {
      const input = { command: 123 }
      const result = getToolSummary("Bash", input)
      expect(result).toBe("123")
    })

    it("should return empty string for unrecognized tool", () => {
      const input = { some_field: "value" }
      const result = getToolSummary("UnknownTool", input)
      expect(result).toBe("")
    })
  })
})

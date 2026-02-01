import { describe, it, expect } from "vitest"
import { matchesSearchQuery } from "./matchesSearchQuery"
import type { TaskCardTask } from "../types"

const task = (overrides: Partial<TaskCardTask> = {}): TaskCardTask => ({
  id: "task-1",
  title: "Fix authentication bug",
  status: "open",
  ...overrides,
})

describe("matchesSearchQuery", () => {
  describe("basic matching", () => {
    it("returns true when query is empty", () => {
      expect(matchesSearchQuery(task(), "")).toBe(true)
    })

    it("returns true when query is whitespace", () => {
      expect(matchesSearchQuery(task(), "   ")).toBe(true)
    })

    it("matches title substring", () => {
      expect(matchesSearchQuery(task(), "auth")).toBe(true)
    })

    it("matches task id", () => {
      expect(matchesSearchQuery(task({ id: "rui-abc123" }), "abc123")).toBe(true)
    })

    it("matches description", () => {
      expect(
        matchesSearchQuery(task({ description: "This involves React hooks" }), "React"),
      ).toBe(true)
    })

    it("is case insensitive", () => {
      expect(matchesSearchQuery(task({ title: "FIX AUTHENTICATION" }), "fix")).toBe(true)
      expect(matchesSearchQuery(task({ title: "fix auth" }), "FIX")).toBe(true)
    })

    it("returns false when no field matches", () => {
      expect(matchesSearchQuery(task(), "zebra")).toBe(false)
    })
  })

  describe("multi-word matching", () => {
    it("matches when all words are present in the title", () => {
      expect(matchesSearchQuery(task({ title: "Fix authentication bug in login" }), "fix bug")).toBe(
        true,
      )
    })

    it("matches words in any order", () => {
      expect(
        matchesSearchQuery(task({ title: "Fix authentication bug" }), "bug fix"),
      ).toBe(true)
    })

    it("matches words across different fields", () => {
      expect(
        matchesSearchQuery(
          task({ title: "Fix login", description: "Authentication is broken" }),
          "login authentication",
        ),
      ).toBe(true)
    })

    it("matches words across id and title", () => {
      expect(
        matchesSearchQuery(task({ id: "rui-abc", title: "Fix something" }), "abc fix"),
      ).toBe(true)
    })

    it("returns false when only some words match", () => {
      expect(matchesSearchQuery(task({ title: "Fix authentication bug" }), "fix zebra")).toBe(false)
    })

    it("handles multiple spaces between words", () => {
      expect(
        matchesSearchQuery(task({ title: "Fix authentication bug" }), "fix   bug"),
      ).toBe(true)
    })

    it("handles leading and trailing spaces", () => {
      expect(
        matchesSearchQuery(task({ title: "Fix authentication bug" }), "  fix bug  "),
      ).toBe(true)
    })

    it("matches three or more words", () => {
      expect(
        matchesSearchQuery(
          task({ title: "Fix critical authentication bug in production" }),
          "fix bug production",
        ),
      ).toBe(true)
    })

    it("each word is matched as substring", () => {
      expect(
        matchesSearchQuery(task({ title: "Fix authentication bug" }), "auth bug"),
      ).toBe(true)
    })
  })

  describe("edge cases", () => {
    it("handles task with no description", () => {
      expect(matchesSearchQuery(task({ description: undefined }), "test")).toBe(false)
    })

    it("handles single character query", () => {
      expect(matchesSearchQuery(task({ title: "Fix bug" }), "F")).toBe(true)
    })

    it("treats single word the same as before", () => {
      expect(matchesSearchQuery(task({ title: "authentication" }), "auth")).toBe(true)
    })
  })
})

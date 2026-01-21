import { describe, it, expect } from "vitest"
import type {
  IssueStatus,
  BdIssue,
  BdDependency,
  BdListOptions,
  BdCreateOptions,
  BdUpdateOptions,
  BdInfo,
  BdLabelResult,
  BdComment,
  MutationType,
  MutationEvent,
} from "./types.js"

describe("beads domain types", () => {
  describe("IssueStatus", () => {
    it("accepts valid status values", () => {
      const statuses: IssueStatus[] = ["open", "in_progress", "blocked", "deferred", "closed"]
      expect(statuses).toHaveLength(5)
    })
  })

  describe("BdIssue", () => {
    it("has required and optional fields", () => {
      const issue: BdIssue = {
        id: "r-abc123",
        title: "Test issue",
        status: "open",
        priority: 2,
        issue_type: "task",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }
      expect(issue.id).toBe("r-abc123")
      expect(issue.status).toBe("open")
    })

    it("accepts optional fields", () => {
      const issue: BdIssue = {
        id: "r-abc123",
        title: "Test issue",
        description: "A test issue description",
        status: "in_progress",
        priority: 1,
        issue_type: "epic",
        owner: "user@example.com",
        created_at: "2024-01-01T00:00:00Z",
        created_by: "creator@example.com",
        updated_at: "2024-01-02T00:00:00Z",
        closed_at: "2024-01-03T00:00:00Z",
        parent: "r-parent",
        dependency_count: 2,
        dependent_count: 1,
      }
      expect(issue.description).toBe("A test issue description")
      expect(issue.owner).toBe("user@example.com")
      expect(issue.parent).toBe("r-parent")
    })
  })

  describe("BdDependency", () => {
    it("extends BdIssue with dependency_type", () => {
      const dependency: BdDependency = {
        id: "r-dep123",
        title: "Dependency issue",
        status: "closed",
        priority: 3,
        issue_type: "bug",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        dependency_type: "blocks",
      }
      expect(dependency.dependency_type).toBe("blocks")
    })
  })

  describe("BdListOptions", () => {
    it("accepts filter options", () => {
      const options: BdListOptions = {
        limit: 100,
        status: "open",
        priority: 1,
        type: "task",
        assignee: "user@example.com",
        parent: "r-parent",
        ready: true,
        all: false,
      }
      expect(options.limit).toBe(100)
      expect(options.ready).toBe(true)
    })
  })

  describe("BdCreateOptions", () => {
    it("requires title and accepts optional fields", () => {
      const options: BdCreateOptions = {
        title: "New issue",
        description: "Description",
        priority: 2,
        type: "task",
        assignee: "user@example.com",
        parent: "r-parent",
        labels: ["bug", "urgent"],
      }
      expect(options.title).toBe("New issue")
      expect(options.labels).toEqual(["bug", "urgent"])
    })
  })

  describe("BdUpdateOptions", () => {
    it("accepts update fields", () => {
      const options: BdUpdateOptions = {
        title: "Updated title",
        status: "in_progress",
        addLabels: ["in-review"],
        removeLabels: ["needs-triage"],
      }
      expect(options.status).toBe("in_progress")
      expect(options.addLabels).toContain("in-review")
    })
  })

  describe("BdInfo", () => {
    it("has database info fields", () => {
      const info: BdInfo = {
        database_path: "/path/to/.beads/beads.db",
        issue_count: 42,
        mode: "daemon",
        daemon_connected: true,
        daemon_status: "running",
        daemon_version: "1.0.0",
        socket_path: "/path/to/.beads/bd.sock",
        config: { key: "value" },
      }
      expect(info.daemon_connected).toBe(true)
      expect(info.issue_count).toBe(42)
    })
  })

  describe("BdLabelResult", () => {
    it("has label operation result fields", () => {
      const result: BdLabelResult = {
        issue_id: "r-abc123",
        label: "bug",
        status: "added",
      }
      expect(result.status).toBe("added")
    })
  })

  describe("BdComment", () => {
    it("has comment fields", () => {
      const comment: BdComment = {
        id: 1,
        issue_id: "r-abc123",
        author: "user@example.com",
        text: "This is a comment",
        created_at: "2024-01-01T00:00:00Z",
      }
      expect(comment.text).toBe("This is a comment")
      expect(comment.author).toBe("user@example.com")
    })
  })

  describe("MutationType", () => {
    it("accepts valid mutation types", () => {
      const types: MutationType[] = [
        "create",
        "update",
        "delete",
        "comment",
        "status",
        "bonded",
        "squashed",
        "burned",
      ]
      expect(types).toHaveLength(8)
    })
  })

  describe("MutationEvent", () => {
    it("has PascalCase fields from daemon", () => {
      const event: MutationEvent = {
        Timestamp: "2024-01-01T00:00:00Z",
        Type: "create",
        IssueID: "r-abc123",
        Title: "New issue",
        Actor: "user@example.com",
      }
      expect(event.Type).toBe("create")
      expect(event.IssueID).toBe("r-abc123")
    })

    it("supports status change fields", () => {
      const event: MutationEvent = {
        Timestamp: "2024-01-01T00:00:00Z",
        Type: "status",
        IssueID: "r-abc123",
        old_status: "open",
        new_status: "in_progress",
      }
      expect(event.old_status).toBe("open")
      expect(event.new_status).toBe("in_progress")
    })
  })
})

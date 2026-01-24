import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { ToolUseCard } from "./ToolUseCard"
import type { ToolUseEvent, ToolName } from "@/types"
import { useAppStore } from "@/store"

// Helper to create a basic tool use event
function createToolEvent(tool: ToolName, overrides?: Partial<ToolUseEvent>): ToolUseEvent {
  return {
    type: "tool_use",
    timestamp: 1705600000000,
    tool,
    ...overrides,
  }
}

describe("ToolUseCard", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.getState().setShowToolOutput(true)
  })

  describe("rendering", () => {
    it("renders tool name", () => {
      render(<ToolUseCard event={createToolEvent("Read")} />)
      expect(screen.getByText("Read")).toBeInTheDocument()
    })

    it("renders file path summary for Read tool", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/path/to/file.ts" },
          })}
        />,
      )
      expect(screen.getByText("/path/to/file.ts")).toBeInTheDocument()
    })

    it("renders command summary for Bash tool", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "npm install" },
          })}
        />,
      )
      expect(screen.getByText("npm install")).toBeInTheDocument()
    })

    it("renders pattern summary for Grep tool", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Grep", {
            input: { pattern: "TODO:" },
          })}
        />,
      )
      expect(screen.getByText("TODO:")).toBeInTheDocument()
    })

    it("renders pattern summary for Glob tool", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Glob", {
            input: { pattern: "**/*.tsx" },
          })}
        />,
      )
      expect(screen.getByText("**/*.tsx")).toBeInTheDocument()
    })

    it("renders query summary for WebSearch tool", () => {
      render(
        <ToolUseCard
          event={createToolEvent("WebSearch", {
            input: { query: "react hooks" },
          })}
        />,
      )
      expect(screen.getByText("react hooks")).toBeInTheDocument()
    })

    it("renders URL summary for WebFetch tool", () => {
      render(
        <ToolUseCard
          event={createToolEvent("WebFetch", {
            input: { url: "https://example.com" },
          })}
        />,
      )
      expect(screen.getByText("https://example.com")).toBeInTheDocument()
    })

    it("renders description summary for Task tool", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Task", {
            input: { description: "Run tests" },
          })}
        />,
      )
      expect(screen.getByText("Run tests")).toBeInTheDocument()
    })
  })

  describe("TodoWrite tool", () => {
    it("renders Update Todos label", () => {
      render(
        <ToolUseCard
          event={createToolEvent("TodoWrite", {
            input: {
              todos: [
                { content: "Task 1", status: "completed" },
                { content: "Task 2", status: "pending" },
              ],
            },
          })}
        />,
      )
      expect(screen.getByText("Update Todos")).toBeInTheDocument()
    })

    it("renders todo items", () => {
      render(
        <ToolUseCard
          event={createToolEvent("TodoWrite", {
            input: {
              todos: [
                { content: "Task 1", status: "completed" },
                { content: "Task 2", status: "pending" },
              ],
            },
          })}
        />,
      )
      expect(screen.getByText("Task 1")).toBeInTheDocument()
      expect(screen.getByText("Task 2")).toBeInTheDocument()
    })

    it("shows checkmark for completed todos", () => {
      render(
        <ToolUseCard
          event={createToolEvent("TodoWrite", {
            input: {
              todos: [{ content: "Task 1", status: "completed" }],
            },
          })}
        />,
      )
      expect(screen.getByText("✓")).toBeInTheDocument()
    })
  })

  describe("status indicator", () => {
    it("shows warning indicator for pending status", () => {
      render(<ToolUseCard event={createToolEvent("Read", { status: "pending" })} />)
      expect(screen.getByLabelText("pending")).toHaveClass("bg-status-warning")
    })

    it("shows info indicator for running status", () => {
      render(<ToolUseCard event={createToolEvent("Read", { status: "running" })} />)
      const indicator = screen.getByLabelText("running")
      expect(indicator).toHaveClass("bg-status-info")
    })

    it("shows success indicator for success status", () => {
      render(<ToolUseCard event={createToolEvent("Read", { status: "success" })} />)
      expect(screen.getByLabelText("success")).toHaveClass("bg-status-success")
    })

    it("shows error indicator for error status", () => {
      render(<ToolUseCard event={createToolEvent("Read", { status: "error" })} />)
      expect(screen.getByLabelText("error")).toHaveClass("bg-status-error")
    })
  })

  describe("expand behavior for Bash tool", () => {
    it("shows output directly when lines fit within preview", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
      )
      // Short output is shown immediately
      expect(screen.getByText("test output")).toBeInTheDocument()
    })

    it("shows truncated preview and expands on click anywhere in output", () => {
      const longOutput = "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8"
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: longOutput,
          })}
        />,
      )

      // First 5 lines should be visible
      expect(screen.getByText(/line 1/)).toBeInTheDocument()

      // Expand indicator should be present
      expect(screen.getByText(/\.\.\. \+3 lines/)).toBeInTheDocument()

      // Line 8 should not be visible initially
      expect(screen.queryByText("line 8")).not.toBeInTheDocument()

      // Click anywhere on the output to expand
      fireEvent.click(screen.getByText(/line 1/))

      // All lines should now be visible
      expect(screen.getByText(/line 8/)).toBeInTheDocument()
    })

    it("shows error without needing to expand", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "exit 1" },
            status: "error",
            error: "Command failed",
          })}
        />,
      )

      // Error is shown immediately
      expect(screen.getByText("Command failed")).toBeInTheDocument()
    })
  })

  describe("Read tool output summary", () => {
    it("shows read line count when output is present", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/test.ts" },
            output: "line 1\nline 2\nline 3",
          })}
        />,
      )

      expect(screen.getByText(/Read 3 lines/)).toBeInTheDocument()
    })

    it("shows singular line for single line output", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/test.ts" },
            output: "single line",
          })}
        />,
      )

      expect(screen.getByText(/Read 1 line/)).toBeInTheDocument()
    })
  })

  describe("Edit tool diff view", () => {
    it("shows diff when old_string and new_string are present", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Edit", {
            input: {
              file_path: "/test.ts",
              old_string: "const x = 1",
              new_string: "const x = 2",
            },
          })}
          defaultExpanded
        />,
      )

      expect(screen.getByText("const x = 1")).toBeInTheDocument()
      expect(screen.getByText("const x = 2")).toBeInTheDocument()
    })

    it("shows truncated diff and expands on click for long diffs", () => {
      // Create a diff with more than 5 lines
      const oldString = "line 1\nline 2\nline 3\nline 4\nline 5"
      const newString =
        "new line 1\nnew line 2\nnew line 3\nnew line 4\nnew line 5\nnew line 6\nnew line 7"
      render(
        <ToolUseCard
          event={createToolEvent("Edit", {
            input: {
              file_path: "/test.ts",
              old_string: oldString,
              new_string: newString,
            },
          })}
        />,
      )

      // Expand indicator should be present (the diff has many lines)
      expect(screen.getByText(/\.\.\. \+\d+ lines/)).toBeInTheDocument()

      // Click to expand
      fireEvent.click(screen.getByText(/\.\.\. \+\d+ lines/))

      // Expand indicator should no longer be present
      expect(screen.queryByText(/\.\.\. \+\d+ lines/)).not.toBeInTheDocument()
    })

    it("shows full diff without truncation when defaultExpanded is true", () => {
      // Create a diff with more than 5 lines
      const oldString = "line 1\nline 2\nline 3\nline 4\nline 5"
      const newString =
        "new line 1\nnew line 2\nnew line 3\nnew line 4\nnew line 5\nnew line 6\nnew line 7"
      render(
        <ToolUseCard
          event={createToolEvent("Edit", {
            input: {
              file_path: "/test.ts",
              old_string: oldString,
              new_string: newString,
            },
          })}
          defaultExpanded
        />,
      )

      // Expand indicator should NOT be present
      expect(screen.queryByText(/\.\.\. \+\d+ lines/)).not.toBeInTheDocument()
    })

    it("shows short diff without truncation", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Edit", {
            input: {
              file_path: "/test.ts",
              old_string: "const x = 1",
              new_string: "const x = 2",
            },
          })}
        />,
      )

      // Both lines should be visible and no expand indicator
      expect(screen.getByText("const x = 1")).toBeInTheDocument()
      expect(screen.getByText("const x = 2")).toBeInTheDocument()
      expect(screen.queryByText(/\.\.\. \+\d+ lines/)).not.toBeInTheDocument()
    })
  })

  describe("Glob tool output display", () => {
    it("shows glob results when output is present", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Glob", {
            input: { pattern: "**/*.tsx" },
            output: "src/App.tsx\nsrc/Button.tsx\nsrc/Header.tsx",
          })}
        />,
      )

      expect(screen.getByText(/src\/App\.tsx/)).toBeInTheDocument()
      expect(screen.getByText(/src\/Button\.tsx/)).toBeInTheDocument()
      expect(screen.getByText(/src\/Header\.tsx/)).toBeInTheDocument()
    })

    it("shows truncated preview and expands on click for long glob results", () => {
      const manyFiles = Array.from({ length: 10 }, (_, i) => `src/file${i}.tsx`).join("\n")
      render(
        <ToolUseCard
          event={createToolEvent("Glob", {
            input: { pattern: "**/*.tsx" },
            output: manyFiles,
          })}
        />,
      )

      // First 5 files should be visible
      expect(screen.getByText(/src\/file0\.tsx/)).toBeInTheDocument()

      // Expand indicator should be present
      expect(screen.getByText(/\.\.\. \+5 lines/)).toBeInTheDocument()

      // File9 should not be visible initially
      expect(screen.queryByText("src/file9.tsx")).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(screen.getByText(/src\/file0\.tsx/))

      // All files should now be visible
      expect(screen.getByText(/src\/file9\.tsx/)).toBeInTheDocument()
    })
  })

  describe("Grep tool output display", () => {
    it("shows grep results when output is present", () => {
      render(
        <ToolUseCard
          event={createToolEvent("Grep", {
            input: { pattern: "TODO" },
            output: "src/App.tsx:15: // TODO: fix this\nsrc/utils.ts:42: // TODO: refactor",
          })}
        />,
      )

      expect(screen.getByText(/src\/App\.tsx:15:/)).toBeInTheDocument()
      expect(screen.getByText(/src\/utils\.ts:42:/)).toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("shows expand indicator and expands on click", () => {
      const longOutput = "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7"
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "test" },
            output: longOutput,
          })}
        />,
      )

      // Expand indicator should be visible
      expect(screen.getByText(/\.\.\. \+2 lines/)).toBeInTheDocument()

      // Click on the output area to expand
      const outputArea = screen.getByText(/line 1/)
      fireEvent.click(outputArea)

      // All content should now be visible
      expect(screen.getByText(/line 7/)).toBeInTheDocument()
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <ToolUseCard event={createToolEvent("Read")} className="custom-class" />,
      )
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("ANSI color output for Bash tool", () => {
    it("strips ANSI color codes from output", () => {
      const ansiOutput = "\x1b[32m✓ test passed\x1b[0m"
      const { container } = render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "npm test" },
            output: ansiOutput,
          })}
        />,
      )
      expect(screen.getByText("✓ test passed")).toBeInTheDocument()
      expect(container.textContent).not.toContain("\x1b[")
    })

    it("strips ANSI color codes for errors", () => {
      const ansiOutput = "\x1b[31mERROR: Something went wrong\x1b[0m"
      const { container } = render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "npm test" },
            output: ansiOutput,
          })}
        />,
      )
      expect(screen.getByText("ERROR: Something went wrong")).toBeInTheDocument()
      expect(container.textContent).not.toContain("\x1b[")
    })

    it("strips multiple ANSI colors in output", () => {
      const ansiOutput = "\x1b[32m✓ passed\x1b[0m \x1b[31m✗ failed\x1b[0m"
      const { container } = render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "npm test" },
            output: ansiOutput,
          })}
        />,
      )
      expect(screen.getByText("✓ passed ✗ failed")).toBeInTheDocument()
      expect(container.textContent).not.toContain("\x1b[")
    })

    it("strips ANSI styling like bold", () => {
      const ansiOutput = "\x1b[1mbold text\x1b[0m"
      const { container } = render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "npm test" },
            output: ansiOutput,
          })}
        />,
      )
      expect(screen.getByText("bold text")).toBeInTheDocument()
      expect(container.textContent).not.toContain("\x1b[")
    })

    it("renders non-ANSI output as plain text", () => {
      const plainOutput = "simple output"
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: plainOutput,
          })}
        />,
      )
      expect(screen.getByText("simple output")).toBeInTheDocument()
    })

    it("truncates long ANSI output and expands on click", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `\x1b[32m✓\x1b[0m test ${i + 1}`).join(
        "\n",
      )
      const { container } = render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "npm test" },
            output: lines,
          })}
        />,
      )

      // Should show truncation indicator
      expect(screen.getByText(/\.\.\. \+5 lines/)).toBeInTheDocument()

      // First few lines should be visible
      expect(screen.getByText(/test 1/)).toBeInTheDocument()

      // Line 10 should not be visible
      expect(screen.queryByText(/test 10/)).not.toBeInTheDocument()

      // Click to expand
      const pre = container.querySelector("pre")
      fireEvent.click(pre!)

      // All lines should now be visible
      expect(screen.getByText(/test 10/)).toBeInTheDocument()
    })

    it("escapes HTML in ANSI output to prevent XSS", () => {
      const ansiOutput = "\x1b[32m<script>alert('xss')</script>\x1b[0m"
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "test" },
            output: ansiOutput,
          })}
        />,
      )
      // Should show escaped HTML, not render as script
      expect(screen.getByText("<script>alert('xss')</script>")).toBeInTheDocument()
    })
  })

  describe("showToolOutput toggle", () => {
    it("hides output section when showToolOutput is false", () => {
      useAppStore.getState().setShowToolOutput(false)
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
      )
      // Tool name and command should still be visible
      expect(screen.getByText("Bash")).toBeInTheDocument()
      expect(screen.getByText("echo test")).toBeInTheDocument()
      // Output should NOT be visible
      expect(screen.queryByText("test output")).not.toBeInTheDocument()
    })

    it("shows output section when showToolOutput is true", () => {
      useAppStore.getState().setShowToolOutput(true)
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
      )
      // Tool name, command, and output should all be visible
      expect(screen.getByText("Bash")).toBeInTheDocument()
      expect(screen.getByText("echo test")).toBeInTheDocument()
      expect(screen.getByText("test output")).toBeInTheDocument()
    })

    it("toggles output visibility with toggleToolOutput", () => {
      useAppStore.getState().setShowToolOutput(false)
      const { rerender } = render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
      )

      // Initially hidden
      expect(screen.queryByText("test output")).not.toBeInTheDocument()

      // Toggle to show
      useAppStore.getState().toggleToolOutput()
      rerender(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
      )

      // Now visible
      expect(screen.getByText("test output")).toBeInTheDocument()
    })

    it("hides diff view for Edit tool when showToolOutput is false", () => {
      useAppStore.getState().setShowToolOutput(false)
      render(
        <ToolUseCard
          event={createToolEvent("Edit", {
            input: {
              file_path: "/test.ts",
              old_string: "const x = 1",
              new_string: "const x = 2",
            },
          })}
        />,
      )
      // Tool name should be visible
      expect(screen.getByText("Edit")).toBeInTheDocument()
      // Diff content should NOT be visible
      expect(screen.queryByText("const x = 1")).not.toBeInTheDocument()
      expect(screen.queryByText("const x = 2")).not.toBeInTheDocument()
    })

    it("hides error message when showToolOutput is false", () => {
      useAppStore.getState().setShowToolOutput(false)
      render(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "exit 1" },
            status: "error",
            error: "Command failed",
          })}
        />,
      )
      // Tool name should be visible
      expect(screen.getByText("Bash")).toBeInTheDocument()
      // Error should NOT be visible
      expect(screen.queryByText("Command failed")).not.toBeInTheDocument()
    })
  })

  describe("relative path display", () => {
    it("shows relative path when file is within workspace", () => {
      useAppStore.getState().setWorkspace("/Users/herbcaudill/Code/HerbCaudill/ralph-ui")
      render(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: {
              file_path: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/components/App.tsx",
            },
          })}
        />,
      )
      expect(screen.getByText("src/components/App.tsx")).toBeInTheDocument()
    })

    it("shows absolute path when file is outside workspace", () => {
      useAppStore.getState().setWorkspace("/Users/herbcaudill/Code/HerbCaudill/ralph-ui")
      render(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/Users/herbcaudill/Code/other-project/index.ts" },
          })}
        />,
      )
      expect(screen.getByText("/Users/herbcaudill/Code/other-project/index.ts")).toBeInTheDocument()
    })

    it("shows absolute path when workspace is not set", () => {
      // workspace is null by default after reset
      render(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/App.tsx" },
          })}
        />,
      )
      expect(
        screen.getByText("/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/App.tsx"),
      ).toBeInTheDocument()
    })

    it("shows relative path for Edit tool", () => {
      useAppStore.getState().setWorkspace("/Users/herbcaudill/Code/HerbCaudill/ralph-ui")
      render(
        <ToolUseCard
          event={createToolEvent("Edit", {
            input: {
              file_path: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/lib/utils.ts",
              old_string: "foo",
              new_string: "bar",
            },
          })}
        />,
      )
      expect(screen.getByText("src/lib/utils.ts")).toBeInTheDocument()
    })

    it("shows relative path for Write tool", () => {
      useAppStore.getState().setWorkspace("/Users/herbcaudill/Code/HerbCaudill/ralph-ui")
      render(
        <ToolUseCard
          event={createToolEvent("Write", {
            input: { file_path: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/new-file.ts" },
          })}
        />,
      )
      expect(screen.getByText("new-file.ts")).toBeInTheDocument()
    })
  })
})

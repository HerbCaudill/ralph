import { render, screen, fireEvent } from "@testing-library/react"
import { useState } from "react"
import { describe, it, expect, vi } from "vitest"
import { ToolUseCard, AgentViewProvider } from "@herbcaudill/agent-view"
import type { ToolUseEvent, ToolName, AgentViewContextValue } from "@herbcaudill/agent-view"
import { AgentViewTestWrapper } from "@/test/agentViewTestWrapper"

/** Helper to create a basic tool use event. */
function createToolEvent(tool: ToolName, overrides?: Partial<ToolUseEvent>): ToolUseEvent {
  return {
    type: "tool_use",
    timestamp: 1705600000000,
    tool,
    ...overrides,
  }
}

/** Render with AgentViewProvider and sensible test defaults. */
function renderWithContext(ui: React.ReactElement, overrides?: Partial<AgentViewContextValue>) {
  return render(<AgentViewTestWrapper value={overrides}>{ui}</AgentViewTestWrapper>)
}

/**
 * Wrapper that manages toolOutput visibility state internally, allowing
 * click-to-toggle tests to work without an external store.
 */
function ToolOutputToggleWrapper({
  children,
  initialVisible = false,
  workspacePath,
}: {
  children: React.ReactElement
  initialVisible?: boolean
  workspacePath?: string | null
}) {
  const [isVisible, setIsVisible] = useState(initialVisible)
  const value: Partial<AgentViewContextValue> = {
    toolOutput: {
      isVisible,
      onToggle: () => setIsVisible(v => !v),
    },
    workspacePath,
  }
  return <AgentViewProvider value={value}>{children}</AgentViewProvider>
}

describe("ToolUseCard", () => {
  describe("rendering", () => {
    it("renders tool name", () => {
      renderWithContext(<ToolUseCard event={createToolEvent("Read")} />)
      expect(screen.getByText("Read")).toBeInTheDocument()
    })

    it.each<[ToolName, Partial<ToolUseEvent>, string]>([
      ["Read", { input: { file_path: "/path/to/file.ts" } }, "/path/to/file.ts"],
      ["Bash", { input: { command: "npm install" } }, "npm install"],
      ["Grep", { input: { pattern: "TODO:" } }, "TODO:"],
      ["Glob", { input: { pattern: "**/*.tsx" } }, "**/*.tsx"],
      ["WebSearch", { input: { query: "react hooks" } }, "react hooks"],
      ["WebFetch", { input: { url: "https://example.com" } }, "https://example.com"],
      ["Task", { input: { description: "Run tests" } }, "Run tests"],
    ])("renders %s summary", (tool, overrides, text) => {
      renderWithContext(<ToolUseCard event={createToolEvent(tool, overrides)} />)
      expect(screen.getByText(text)).toBeInTheDocument()
    })
  })

  describe("TodoWrite tool", () => {
    it("renders Update Todos label", () => {
      renderWithContext(
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
      renderWithContext(
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
      renderWithContext(
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
      renderWithContext(<ToolUseCard event={createToolEvent("Read", { status: "pending" })} />)
      expect(screen.getByLabelText("pending")).toHaveClass("bg-status-warning")
    })

    it("shows info indicator for running status", () => {
      renderWithContext(<ToolUseCard event={createToolEvent("Read", { status: "running" })} />)
      const indicator = screen.getByLabelText("running")
      expect(indicator).toHaveClass("bg-status-info")
    })

    it("shows success indicator for success status", () => {
      renderWithContext(<ToolUseCard event={createToolEvent("Read", { status: "success" })} />)
      expect(screen.getByLabelText("success")).toHaveClass("bg-status-success")
    })

    it("shows error indicator for error status", () => {
      renderWithContext(<ToolUseCard event={createToolEvent("Read", { status: "error" })} />)
      expect(screen.getByLabelText("error")).toHaveClass("bg-status-error")
    })
  })

  describe("expand behavior for Bash tool", () => {
    it("shows output directly when lines fit within preview", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
      )
      expect(screen.getByText("test output")).toBeInTheDocument()
    })

    it("shows truncated preview and expands on click anywhere in output", () => {
      const longOutput = "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8"
      renderWithContext(
        <ToolUseCard
          defaultExpanded={false}
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: longOutput,
          })}
        />,
      )

      expect(screen.getByText(/line 1/)).toBeInTheDocument()
      expect(screen.getByText(/\.\.\. \+3 lines/)).toBeInTheDocument()
      expect(screen.queryByText("line 8")).not.toBeInTheDocument()

      fireEvent.click(screen.getByText(/line 1/))
      expect(screen.getByText(/line 8/)).toBeInTheDocument()
    })

    it("shows error without needing to expand", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "exit 1" },
            status: "error",
            error: "Command failed",
          })}
        />,
      )
      expect(screen.getByText("Command failed")).toBeInTheDocument()
    })
  })

  describe("Read tool output summary", () => {
    it("shows read line count when output is present", () => {
      renderWithContext(
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
      renderWithContext(
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
      renderWithContext(
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
      const oldString = "line 1\nline 2\nline 3\nline 4\nline 5"
      const newString =
        "new line 1\nnew line 2\nnew line 3\nnew line 4\nnew line 5\nnew line 6\nnew line 7"
      renderWithContext(
        <ToolUseCard
          defaultExpanded={false}
          event={createToolEvent("Edit", {
            input: {
              file_path: "/test.ts",
              old_string: oldString,
              new_string: newString,
            },
          })}
        />,
      )

      expect(screen.getByText(/\.\.\. \+\d+ lines/)).toBeInTheDocument()
      fireEvent.click(screen.getByText(/\.\.\. \+\d+ lines/))
      expect(screen.queryByText(/\.\.\. \+\d+ lines/)).not.toBeInTheDocument()
    })

    it("shows full diff without truncation when defaultExpanded is true", () => {
      const oldString = "line 1\nline 2\nline 3\nline 4\nline 5"
      const newString =
        "new line 1\nnew line 2\nnew line 3\nnew line 4\nnew line 5\nnew line 6\nnew line 7"
      renderWithContext(
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
      expect(screen.queryByText(/\.\.\. \+\d+ lines/)).not.toBeInTheDocument()
    })

    it("shows short diff without truncation", () => {
      renderWithContext(
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
      expect(screen.getByText("const x = 1")).toBeInTheDocument()
      expect(screen.getByText("const x = 2")).toBeInTheDocument()
      expect(screen.queryByText(/\.\.\. \+\d+ lines/)).not.toBeInTheDocument()
    })
  })

  describe("Glob tool output display", () => {
    it("shows glob results when output is present", () => {
      renderWithContext(
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
      renderWithContext(
        <ToolUseCard
          defaultExpanded={false}
          event={createToolEvent("Glob", {
            input: { pattern: "**/*.tsx" },
            output: manyFiles,
          })}
        />,
      )

      expect(screen.getByText(/src\/file0\.tsx/)).toBeInTheDocument()
      expect(screen.getByText(/\.\.\. \+5 lines/)).toBeInTheDocument()
      expect(screen.queryByText("src/file9.tsx")).not.toBeInTheDocument()

      fireEvent.click(screen.getByText(/src\/file0\.tsx/))
      expect(screen.getByText(/src\/file9\.tsx/)).toBeInTheDocument()
    })
  })

  describe("Grep tool output display", () => {
    it("shows grep results when output is present", () => {
      renderWithContext(
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
      renderWithContext(
        <ToolUseCard
          defaultExpanded={false}
          event={createToolEvent("Bash", {
            input: { command: "test" },
            output: longOutput,
          })}
        />,
      )

      expect(screen.getByText(/\.\.\. \+2 lines/)).toBeInTheDocument()
      const outputArea = screen.getByText(/line 1/)
      fireEvent.click(outputArea)
      expect(screen.getByText(/line 7/)).toBeInTheDocument()
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      const { container } = renderWithContext(
        <ToolUseCard event={createToolEvent("Read")} className="custom-class" />,
      )
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("ANSI color output for Bash tool", () => {
    it("strips ANSI color codes from output", () => {
      const ansiOutput = "\x1b[32m✓ test passed\x1b[0m"
      const { container } = renderWithContext(
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
      const { container } = renderWithContext(
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
      const { container } = renderWithContext(
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
      const { container } = renderWithContext(
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
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "simple output",
          })}
        />,
      )
      expect(screen.getByText("simple output")).toBeInTheDocument()
    })

    it("truncates long ANSI output and expands on click", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `\x1b[32m✓\x1b[0m test ${i + 1}`).join(
        "\n",
      )
      const { container } = renderWithContext(
        <ToolUseCard
          defaultExpanded={false}
          event={createToolEvent("Bash", {
            input: { command: "npm test" },
            output: lines,
          })}
        />,
      )

      expect(screen.getByText(/\.\.\. \+5 lines/)).toBeInTheDocument()
      expect(screen.getByText(/test 1/)).toBeInTheDocument()
      expect(screen.queryByText(/test 10/)).not.toBeInTheDocument()

      const pre = container.querySelector("pre")
      fireEvent.click(pre!)
      expect(screen.getByText(/test 10/)).toBeInTheDocument()
    })

    it("escapes HTML in ANSI output to prevent XSS", () => {
      const ansiOutput = "\x1b[32m<script>alert('xss')</script>\x1b[0m"
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "test" },
            output: ansiOutput,
          })}
        />,
      )
      expect(screen.getByText("<script>alert('xss')</script>")).toBeInTheDocument()
    })
  })

  describe("showToolOutput toggle", () => {
    it("hides output section when showToolOutput is false", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
        { toolOutput: { isVisible: false, onToggle: vi.fn() } },
      )
      expect(screen.getByText("Bash")).toBeInTheDocument()
      expect(screen.getByText("echo test")).toBeInTheDocument()
      expect(screen.queryByText("test output")).not.toBeInTheDocument()
    })

    it("shows output section when showToolOutput is true", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
        { toolOutput: { isVisible: true, onToggle: vi.fn() } },
      )
      expect(screen.getByText("Bash")).toBeInTheDocument()
      expect(screen.getByText("echo test")).toBeInTheDocument()
      expect(screen.getByText("test output")).toBeInTheDocument()
    })

    it("toggles output visibility with toggleToolOutput", () => {
      const { unmount } = render(
        <ToolOutputToggleWrapper initialVisible={false}>
          <ToolUseCard
            event={createToolEvent("Bash", {
              input: { command: "echo test" },
              output: "test output",
            })}
          />
        </ToolOutputToggleWrapper>,
      )

      // Initially hidden
      expect(screen.queryByText("test output")).not.toBeInTheDocument()

      // Click to toggle on
      fireEvent.click(screen.getByRole("button", { name: "Toggle Bash output" }))
      expect(screen.getByText("test output")).toBeInTheDocument()

      unmount()
    })

    it("hides diff view for Edit tool when showToolOutput is false", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Edit", {
            input: {
              file_path: "/test.ts",
              old_string: "const x = 1",
              new_string: "const x = 2",
            },
          })}
        />,
        { toolOutput: { isVisible: false, onToggle: vi.fn() } },
      )
      expect(screen.getByText("Edit")).toBeInTheDocument()
      expect(screen.queryByText("const x = 1")).not.toBeInTheDocument()
      expect(screen.queryByText("const x = 2")).not.toBeInTheDocument()
    })

    it("hides error message when showToolOutput is false", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "exit 1" },
            status: "error",
            error: "Command failed",
          })}
        />,
        { toolOutput: { isVisible: false, onToggle: vi.fn() } },
      )
      expect(screen.getByText("Bash")).toBeInTheDocument()
      expect(screen.queryByText("Command failed")).not.toBeInTheDocument()
    })
  })

  describe("click-to-toggle tool output", () => {
    it("clicking tool header toggles tool output visibility when expandable content exists", () => {
      render(
        <ToolOutputToggleWrapper initialVisible={false}>
          <ToolUseCard
            event={createToolEvent("Bash", {
              input: { command: "echo test" },
              output: "test output",
            })}
          />
        </ToolOutputToggleWrapper>,
      )

      expect(screen.queryByText("test output")).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Toggle Bash output" }))
      expect(screen.getByText("test output")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Toggle Bash output" }))
      expect(screen.queryByText("test output")).not.toBeInTheDocument()
    })

    it("shows ▸ disclosure triangle when collapsed", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
        { toolOutput: { isVisible: false, onToggle: vi.fn() } },
      )
      expect(screen.getByText("▸")).toBeInTheDocument()
    })

    it("shows ▾ disclosure triangle when expanded", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
        { toolOutput: { isVisible: true, onToggle: vi.fn() } },
      )
      expect(screen.getByText("▾")).toBeInTheDocument()
    })

    it("does not toggle when there is no expandable content", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/path/to/file.ts" },
          })}
        />,
        { toolOutput: { isVisible: false, onToggle: vi.fn() } },
      )

      expect(screen.queryByText("▸")).not.toBeInTheDocument()
      expect(screen.queryByText("▾")).not.toBeInTheDocument()
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })

    it("clicking header toggles for Edit tool with diff content", () => {
      render(
        <ToolOutputToggleWrapper initialVisible={false}>
          <ToolUseCard
            event={createToolEvent("Edit", {
              input: {
                file_path: "/test.ts",
                old_string: "const x = 1",
                new_string: "const x = 2",
              },
            })}
          />
        </ToolOutputToggleWrapper>,
      )

      expect(screen.queryByText("const x = 1")).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Toggle Edit output" }))

      expect(screen.getByText("const x = 1")).toBeInTheDocument()
      expect(screen.getByText("const x = 2")).toBeInTheDocument()
    })

    it("clicking header toggles for tool with error", () => {
      render(
        <ToolOutputToggleWrapper initialVisible={false}>
          <ToolUseCard
            event={createToolEvent("Bash", {
              input: { command: "exit 1" },
              status: "error",
              error: "Command failed",
            })}
          />
        </ToolOutputToggleWrapper>,
      )

      expect(screen.queryByText("Command failed")).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Toggle Bash output" }))
      expect(screen.getByText("Command failed")).toBeInTheDocument()
    })
  })

  describe("click-to-toggle accessibility", () => {
    it("has role=button when expandable content exists", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
      )
      expect(screen.getByRole("button", { name: "Toggle Bash output" })).toBeInTheDocument()
    })

    it("has aria-expanded=true when tool output is shown", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
        { toolOutput: { isVisible: true, onToggle: vi.fn() } },
      )
      expect(screen.getByRole("button", { name: "Toggle Bash output" })).toHaveAttribute(
        "aria-expanded",
        "true",
      )
    })

    it("has aria-expanded=false when tool output is hidden", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Bash", {
            input: { command: "echo test" },
            output: "test output",
          })}
        />,
        { toolOutput: { isVisible: false, onToggle: vi.fn() } },
      )
      expect(screen.getByRole("button", { name: "Toggle Bash output" })).toHaveAttribute(
        "aria-expanded",
        "false",
      )
    })

    it("does not have role=button or aria-expanded without expandable content", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/path/to/file.ts" },
          })}
        />,
      )
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
  })

  describe("relative path display", () => {
    it("shows relative path when file is within workspace", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: {
              file_path: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/components/App.tsx",
            },
          })}
        />,
        { workspacePath: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui" },
      )
      expect(screen.getByText("src/components/App.tsx")).toBeInTheDocument()
    })

    it("shows absolute path when file is outside workspace", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/Users/herbcaudill/Code/other-project/index.ts" },
          })}
        />,
        { workspacePath: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui" },
      )
      expect(screen.getByText("/Users/herbcaudill/Code/other-project/index.ts")).toBeInTheDocument()
    })

    it("shows absolute path when workspace is not set", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Read", {
            input: { file_path: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/App.tsx" },
          })}
        />,
        { workspacePath: undefined },
      )
      expect(
        screen.getByText("/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/App.tsx"),
      ).toBeInTheDocument()
    })

    it("shows relative path for Edit tool", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Edit", {
            input: {
              file_path: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/lib/utils.ts",
              old_string: "foo",
              new_string: "bar",
            },
          })}
        />,
        { workspacePath: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui" },
      )
      expect(screen.getByText("src/lib/utils.ts")).toBeInTheDocument()
    })

    it("shows relative path for Write tool", () => {
      renderWithContext(
        <ToolUseCard
          event={createToolEvent("Write", {
            input: { file_path: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/new-file.ts" },
          })}
        />,
        { workspacePath: "/Users/herbcaudill/Code/HerbCaudill/ralph-ui" },
      )
      expect(screen.getByText("new-file.ts")).toBeInTheDocument()
    })
  })
})

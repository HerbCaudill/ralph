import { toRelativePath } from "./toRelativePath"
import type { ToolName } from "../types"

/**  Generate a concise summary string for a tool invocation based on its primary input parameter. */
export function getToolSummary(
  /** The name of the tool */
  tool: ToolName | string,
  /** The tool's input parameters */
  input?: Record<string, unknown>,
  /** The workspace root path for relative path conversion */
  workspace?: string | null,
): string {
  if (!input) return ""

  // Normalize tool name to lowercase for case-insensitive matching
  // (some adapters like Codex emit lowercase tool names)
  const normalizedTool = tool.toLowerCase()

  switch (normalizedTool) {
    case "read":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "edit":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "write":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "bash":
      return input.command ? String(input.command) : ""
    case "grep":
      return input.pattern ? String(input.pattern) : ""
    case "glob":
      return input.pattern ? String(input.pattern) : ""
    case "websearch":
      return input.query ? String(input.query) : ""
    case "webfetch":
      return input.url ? String(input.url) : ""
    case "todowrite":
      if (Array.isArray(input.todos)) {
        return `${input.todos.length} todo(s)`
      }
      return ""
    case "task":
      return input.description ? String(input.description) : ""
    default:
      return ""
  }
}

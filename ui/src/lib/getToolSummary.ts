import { toRelativePath } from "@/lib/toRelativePath"
import type { ToolName } from "@/types"

export function getToolSummary(
  tool: ToolName,
  input?: Record<string, unknown>,
  workspace?: string | null,
): string {
  if (!input) return ""

  switch (tool) {
    case "Read":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "Edit":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "Write":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "Bash":
      return input.command ? String(input.command) : ""
    case "Grep":
      return input.pattern ? String(input.pattern) : ""
    case "Glob":
      return input.pattern ? String(input.pattern) : ""
    case "WebSearch":
      return input.query ? String(input.query) : ""
    case "WebFetch":
      return input.url ? String(input.url) : ""
    case "TodoWrite":
      if (Array.isArray(input.todos)) {
        return `${input.todos.length} todo(s)`
      }
      return ""
    case "Task":
      return input.description ? String(input.description) : ""
    default:
      return ""
  }
}

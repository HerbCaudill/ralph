import { toRelativePath } from "./toRelativePath"
import { normalizeToolName } from "./normalizeToolName"

/**  Generate a concise summary string for a tool invocation based on its primary input parameter. */
export function getToolSummary(
  /** The name of the tool (accepts any casing; normalized internally) */
  tool: string,
  /** The tool's input parameters */
  input?: Record<string, unknown>,
  /** The workspace root path for relative path conversion */
  workspace?: string | null,
): string {
  if (!input) return ""

  const normalized = normalizeToolName(tool)

  switch (normalized) {
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

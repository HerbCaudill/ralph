import { toRelativePath } from "./toRelativePath"
import { normalizeToolName } from "./normalizeToolName"

/**  Generate a concise summary string for a tool invocation based on its primary input parameter. */
export function getToolSummary(
  /** The name of the tool (accepts any casing; normalized internally) */
  tool: string,
  /** The tool's input parameters */
  input?: Record<string, unknown> | string,
  /** The workspace root path for relative path conversion */
  workspace?: string | null,
): string {
  if (!input) return ""

  const rawInput = input
  let resolvedInput: Record<string, unknown> = {}

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input)
      if (parsed && typeof parsed === "object") {
        resolvedInput = parsed as Record<string, unknown>
      }
    } catch {
      // Fall back to empty object, raw string handled per-tool below.
    }
  } else {
    resolvedInput = input
  }

  const normalized = normalizeToolName(tool)

  switch (normalized) {
    case "Read":
      return resolvedInput.file_path ?
          toRelativePath(String(resolvedInput.file_path), workspace ?? null)
        : ""
    case "Edit":
      return resolvedInput.file_path ?
          toRelativePath(String(resolvedInput.file_path), workspace ?? null)
        : ""
    case "Write":
      return resolvedInput.file_path ?
          toRelativePath(String(resolvedInput.file_path), workspace ?? null)
        : ""
    case "Bash":
      return resolvedInput.command ? String(resolvedInput.command)
      : typeof rawInput === "string" && rawInput.trim() ?
        rawInput
      : ""
    case "Grep":
      return resolvedInput.pattern ? String(resolvedInput.pattern) : ""
    case "Glob":
      return resolvedInput.pattern ? String(resolvedInput.pattern) : ""
    case "WebSearch":
      return resolvedInput.query ? String(resolvedInput.query) : ""
    case "WebFetch":
      return resolvedInput.url ? String(resolvedInput.url) : ""
    case "TodoWrite":
      if (Array.isArray(resolvedInput.todos)) {
        return `${resolvedInput.todos.length} todo(s)`
      }
      return ""
    case "Task":
      return resolvedInput.description ? String(resolvedInput.description) : ""
    default:
      return ""
  }
}

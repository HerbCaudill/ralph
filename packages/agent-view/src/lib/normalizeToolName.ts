import type { ToolName } from "../types"

/**
 * Map of lowercase tool names to their canonical PascalCase form.
 * Used to normalize tool names from adapters that emit different casings
 * (e.g., Codex emits "bash" while Claude emits "Bash").
 */
const TOOL_NAME_MAP: Record<string, ToolName> = {
  read: "Read",
  edit: "Edit",
  write: "Write",
  bash: "Bash",
  grep: "Grep",
  glob: "Glob",
  websearch: "WebSearch",
  webfetch: "WebFetch",
  todowrite: "TodoWrite",
  task: "Task",
}

/**
 * Normalize a tool name to its canonical PascalCase form.
 * Handles case-insensitive matching for known tools.
 * Returns unknown tool names unchanged.
 */
export function normalizeToolName(tool: string): string {
  return TOOL_NAME_MAP[tool.toLowerCase()] ?? tool
}

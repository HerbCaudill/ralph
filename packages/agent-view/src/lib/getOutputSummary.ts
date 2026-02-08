import { normalizeToolName } from "./normalizeToolName"

/** Generate a concise summary string for the output of a tool invocation. */
export function getOutputSummary(
  /** The name of the tool (accepts any casing; normalized internally) */
  tool: string,
  /** The tool's output text */
  output?: string,
): string | null {
  if (!output) return null

  const normalized = normalizeToolName(tool)

  if (normalized === "Read") {
    const lines = output.split("\n").length
    return `Read ${lines} line${lines !== 1 ? "s" : ""}`
  }

  return null
}

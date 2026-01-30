import type { ToolName } from "../types"

export function getOutputSummary(tool: ToolName, output?: string): string | null {
  if (!output) return null

  if (tool === "Read") {
    const lines = output.split("\n").length
    return `Read ${lines} line${lines !== 1 ? "s" : ""}`
  }

  return null
}

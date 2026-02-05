import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadSessionPrompt } from "@herbcaudill/ralph-shared/prompts"

/**
 * Load the Ralph system prompt by combining core.prompt.md with workflow.prompt.md.
 * Uses templates from the agent-server/templates directory.
 */
export async function loadRalphPrompt(
  /** Working directory context (for loading workspace-specific workflow.prompt.md). */
  cwd?: string,
): Promise<string> {
  const __dirname = dirname(fileURLToPath(import.meta.url))

  // Templates are in agent-server/templates (relative to this file in agent-server/src/lib)
  const templatesDir = join(__dirname, "..", "..", "templates")

  // Load session prompt (combines core.prompt.md with workflow.prompt.md)
  const { content } = loadSessionPrompt({
    templatesDir,
    cwd: cwd ?? process.cwd(),
  })

  return content
}

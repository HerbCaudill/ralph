import { existsSync, readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { loadSessionPrompt } from "@herbcaudill/ralph-shared"

/**
 * Get the prompt content by combining core-prompt.md with workflow.md.
 *
 * First checks for a custom prompt at .ralph/prompt.md. If that exists, uses it directly.
 * Otherwise, loads the session prompt which combines:
 * - core-prompt.md (always from templates)
 * - workflow.md (from .ralph/workflow.md if it exists, otherwise from templates)
 */
export const getPromptContent = (): string => {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const ralphDir = join(process.cwd(), ".ralph")
  const promptFile = join(ralphDir, "prompt.md")
  const templatesDir = join(__dirname, "..", "..", "templates")

  // First, try to read from .ralph/prompt.md (custom override)
  if (existsSync(promptFile)) {
    return readFileSync(promptFile, "utf-8")
  }

  // Load session prompt (combines core-prompt.md with workflow.md)
  const { content } = loadSessionPrompt({
    templatesDir,
    cwd: process.cwd(),
  })

  return content
}

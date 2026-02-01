import { existsSync, readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { loadSessionPrompt, getWorkspaceRoot } from "@herbcaudill/ralph-shared/prompts"

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
  const workspaceRoot = getWorkspaceRoot(process.cwd())
  const ralphDir = join(workspaceRoot, ".ralph")
  const promptFile = join(ralphDir, "prompt.md")

  // Resolve templates directory relative to this file's location.
  // In source (src/lib/): ../../templates → packages/cli/templates ✓
  // In bundle (dist/):    ../../templates → packages/templates ✗
  // We try both paths to support both dev and bundled modes.
  let templatesDir = join(__dirname, "..", "..", "templates")
  if (!existsSync(join(templatesDir, "core-prompt.md"))) {
    templatesDir = join(__dirname, "..", "templates")
  }

  // First, try to read from .ralph/prompt.md (custom override)
  if (existsSync(promptFile)) {
    return readFileSync(promptFile, "utf-8")
  }

  // Load session prompt (combines core-prompt.md with workflow.md)
  const { content } = loadSessionPrompt({
    templatesDir,
    cwd: workspaceRoot,
  })

  return content
}

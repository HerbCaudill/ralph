import { readFileSync, existsSync } from "fs"
import { join, dirname, basename } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ralphDir = join(process.cwd(), ".ralph")
const promptFile = join(ralphDir, "prompt.md")
const todoFile = join(ralphDir, "todo.md")
const beadsDir = join(process.cwd(), ".beads")
const templatesDir = join(__dirname, "..", "..", "templates")

/**
 * Get the prompt content, falling back to templates if .ralph/prompt.md doesn't exist.
 * Uses the appropriate template based on the project setup:
 * - If .beads directory exists OR no .ralph/todo.md: use prompt-beads.md
 * - If .ralph/todo.md exists: use prompt-todos.md (todo-based workflow)
 */
export const getPromptContent = (): string => {
  // First, try to read from .ralph/prompt.md
  if (existsSync(promptFile)) {
    return readFileSync(promptFile, "utf-8")
  }

  // Fall back to templates based on project setup
  const useBeadsTemplate = existsSync(beadsDir) || !existsSync(todoFile)
  const templateFile = useBeadsTemplate ? "prompt-beads.md" : "prompt-todos.md"
  const templatePath = join(templatesDir, templateFile)

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, "utf-8")
  }

  // Last resort: return a minimal prompt
  return "Work on the highest-priority task."
}

import { existsSync, readFileSync, copyFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Default system prompt filename */
const SYSTEM_PROMPT_FILENAME = "task-chat-system.md"

/** Path to the default system prompt in the server/prompts directory */
const DEFAULT_PROMPT_PATH = join(__dirname, "prompts", SYSTEM_PROMPT_FILENAME)

/**
 * Get the path to the customized system prompt in the .ralph folder.
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Path to the customized prompt file
 */
export function getCustomPromptPath(cwd: string = process.cwd()): string {
  return join(cwd, ".ralph", SYSTEM_PROMPT_FILENAME)
}

/**
 * Get the path to the default system prompt.
 *
 * @returns Path to the default prompt file
 */
export function getDefaultPromptPath(): string {
  return DEFAULT_PROMPT_PATH
}

/**
 * Load the task chat system prompt.
 *
 * Looks for a customized prompt in the .ralph folder first.
 * Falls back to the default prompt if no customization exists.
 *
 * @param cwd - Working directory to look for .ralph folder (defaults to process.cwd())
 * @returns The system prompt content
 * @throws Error if no prompt file can be found
 */
export function loadSystemPrompt(cwd: string = process.cwd()): string {
  const customPath = getCustomPromptPath(cwd)

  // Try to load customized prompt first
  if (existsSync(customPath)) {
    return readFileSync(customPath, "utf-8")
  }

  // Fall back to default prompt
  if (existsSync(DEFAULT_PROMPT_PATH)) {
    return readFileSync(DEFAULT_PROMPT_PATH, "utf-8")
  }

  throw new Error(`System prompt not found at ${customPath} or ${DEFAULT_PROMPT_PATH}`)
}

/**
 * Initialize the system prompt by copying the default to .ralph folder if it doesn't exist.
 *
 * This allows users to customize the prompt on a per-repo basis.
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Object with path and whether it was newly created
 */
export function initSystemPrompt(cwd: string = process.cwd()): {
  path: string
  created: boolean
} {
  const customPath = getCustomPromptPath(cwd)

  // Already exists - no need to copy
  if (existsSync(customPath)) {
    return { path: customPath, created: false }
  }

  // Ensure .ralph directory exists
  const ralphDir = dirname(customPath)
  if (!existsSync(ralphDir)) {
    mkdirSync(ralphDir, { recursive: true })
  }

  // Copy default prompt to .ralph folder
  if (existsSync(DEFAULT_PROMPT_PATH)) {
    copyFileSync(DEFAULT_PROMPT_PATH, customPath)
    return { path: customPath, created: true }
  }

  throw new Error(`Default system prompt not found at ${DEFAULT_PROMPT_PATH}`)
}

import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  loadPrompt,
  initPrompt,
  getCustomPromptPath as sharedGetCustomPromptPath,
} from "@herbcaudill/ralph-shared"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Default system prompt filename */
const SYSTEM_PROMPT_FILENAME = "task-chat-system.md"

/** Custom prompt directory name */
const CUSTOM_PROMPT_DIR = ".ralph"

/** Path to the default system prompt in the server/prompts directory */
const DEFAULT_PROMPT_PATH = join(__dirname, "prompts", SYSTEM_PROMPT_FILENAME)

/**
 * Get the path to the customized system prompt in the .ralph folder.
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Path to the customized prompt file
 */
export function getCustomPromptPath(cwd: string = process.cwd()): string {
  return sharedGetCustomPromptPath({
    filename: SYSTEM_PROMPT_FILENAME,
    customDir: CUSTOM_PROMPT_DIR,
    cwd,
  })
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
  const result = loadPrompt({
    filename: SYSTEM_PROMPT_FILENAME,
    customDir: CUSTOM_PROMPT_DIR,
    defaultPath: DEFAULT_PROMPT_PATH,
    cwd,
  })
  return result.content
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
  return initPrompt({
    filename: SYSTEM_PROMPT_FILENAME,
    customDir: CUSTOM_PROMPT_DIR,
    defaultPath: DEFAULT_PROMPT_PATH,
    cwd,
  })
}

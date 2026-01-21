import { existsSync, readFileSync, copyFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"

/**
 * Configuration for loading a prompt file.
 */
export type LoadPromptOptions = {
  /** Name of the prompt file (e.g., "prompt.md" or "task-chat-system.md") */
  filename: string
  /** Path to the custom prompt directory (e.g., ".ralph") */
  customDir: string
  /** Path to the default prompt file */
  defaultPath: string
  /** Working directory to search for custom prompt (defaults to process.cwd()) */
  cwd?: string
}

/**
 * Result from loading a prompt file.
 */
export type LoadPromptResult = {
  /** The prompt content */
  content: string
  /** The path from which the prompt was loaded */
  path: string
  /** Whether the prompt was loaded from a custom location */
  isCustom: boolean
}

/**
 * Get the path to a custom prompt file.
 *
 * @param options - Configuration options
 * @returns Path to the custom prompt file
 */
export function getCustomPromptPath(options: {
  filename: string
  customDir: string
  cwd?: string
}): string {
  const { filename, customDir, cwd = process.cwd() } = options
  return join(cwd, customDir, filename)
}

/**
 * Load a prompt file with fallback to default.
 *
 * First checks for a customized prompt in the custom directory.
 * Falls back to the default prompt if no customization exists.
 *
 * @param options - Configuration for loading the prompt
 * @returns Result object with content, path, and isCustom flag
 * @throws Error if no prompt file can be found at either location
 */
export function loadPrompt(options: LoadPromptOptions): LoadPromptResult {
  const { filename, customDir, defaultPath, cwd = process.cwd() } = options
  const customPath = getCustomPromptPath({ filename, customDir, cwd })

  // Try to load customized prompt first
  if (existsSync(customPath)) {
    return {
      content: readFileSync(customPath, "utf-8"),
      path: customPath,
      isCustom: true,
    }
  }

  // Fall back to default prompt
  if (existsSync(defaultPath)) {
    return {
      content: readFileSync(defaultPath, "utf-8"),
      path: defaultPath,
      isCustom: false,
    }
  }

  throw new Error(`Prompt file not found at ${customPath} or ${defaultPath}`)
}

/**
 * Initialize a prompt by copying the default to the custom directory if it doesn't exist.
 *
 * This allows users to customize the prompt on a per-project basis.
 *
 * @param options - Configuration for initializing the prompt
 * @returns Object with path and whether it was newly created
 * @throws Error if the default prompt file doesn't exist
 */
export function initPrompt(options: LoadPromptOptions): {
  path: string
  created: boolean
} {
  const { filename, customDir, defaultPath, cwd = process.cwd() } = options
  const customPath = getCustomPromptPath({ filename, customDir, cwd })

  // Already exists - no need to copy
  if (existsSync(customPath)) {
    return { path: customPath, created: false }
  }

  // Ensure custom directory exists
  const customDirPath = dirname(customPath)
  if (!existsSync(customDirPath)) {
    mkdirSync(customDirPath, { recursive: true })
  }

  // Copy default prompt to custom directory
  if (existsSync(defaultPath)) {
    copyFileSync(defaultPath, customPath)
    return { path: customPath, created: true }
  }

  throw new Error(`Default prompt not found at ${defaultPath}`)
}

/**
 * Check if a custom prompt file exists.
 *
 * @param options - Configuration options
 * @returns True if a custom prompt file exists
 */
export function hasCustomPrompt(options: {
  filename: string
  customDir: string
  cwd?: string
}): boolean {
  const customPath = getCustomPromptPath(options)
  return existsSync(customPath)
}

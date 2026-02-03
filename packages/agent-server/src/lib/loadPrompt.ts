import { loadContextFileSync, type AdapterType } from "./loadContextFile.js"

/** Options for assembling a complete prompt. */
export interface AssemblePromptOptions {
  /** Working directory for context file lookup. */
  cwd?: string
  /** Adapter type to determine which context file to load. Defaults to "claude". */
  adapter?: AdapterType
  /** Custom system prompt to include. */
  systemPrompt?: string
  /** Whether to include working directory context in the prompt. */
  includeWorkingDirectoryContext?: boolean
}

/**
 * Build the working directory context string for system prompts.
 * Provides explicit instructions to prevent the agent from constructing incorrect absolute paths.
 */
export function buildCwdContext(cwd: string): string {
  return [
    `## Environment`,
    ``,
    `Working directory: ${cwd}`,
    ``,
    `IMPORTANT: All file paths MUST be relative to the working directory above, or absolute paths starting with exactly \`${cwd}/\`.`,
    `Never construct absolute paths by guessing usernames, directory structures, or paths from code snippets.`,
    `If a file path fails, retry using a path relative to the working directory.`,
  ].join("\n")
}

/**
 * Assemble a complete prompt from various components.
 *
 * Components are assembled in this order:
 * 1. Context file content (CLAUDE.md/AGENTS.md from global and workspace)
 * 2. Working directory context (if includeWorkingDirectoryContext is true)
 * 3. Custom system prompt (if provided)
 *
 * @param options - Assembly options
 * @returns The assembled prompt string, or empty string if no components exist
 */
export function assemblePrompt(options: AssemblePromptOptions = {}): string {
  const { cwd, adapter = "claude", systemPrompt, includeWorkingDirectoryContext = false } = options
  const parts: string[] = []

  // 1. Load adapter-specific context file
  const contextFileContent = loadContextFileSync({ cwd, adapter })
  if (contextFileContent) {
    parts.push(contextFileContent.trim())
  }

  // 2. Add working directory context if requested
  if (includeWorkingDirectoryContext && cwd) {
    parts.push(buildCwdContext(cwd))
  }

  // 3. Add custom system prompt
  if (systemPrompt) {
    parts.push(systemPrompt.trim())
  }

  return parts.join("\n\n").trim()
}

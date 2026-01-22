import { loadSkill, type LoadSkillResult, type SkillMetadata } from "./loadSkill.js"

/** The skill used for task chat */
const TASK_CHAT_SKILL = "manage-tasks"

/**
 * Load the task chat system prompt from the manage-tasks skill.
 *
 * Looks for a customized skill in the project's .claude/skills/ directory first.
 * Falls back to the bundled default skill if no customization exists.
 *
 * @param cwd - Working directory to look for custom skill (defaults to process.cwd())
 * @returns The system prompt content (skill body without frontmatter)
 * @throws Error if skill cannot be found
 */
export function loadSystemPrompt(cwd: string = process.cwd()): string {
  const result = loadSkill(TASK_CHAT_SKILL, cwd)
  return result.content
}

/**
 * Load the full task chat skill with metadata.
 *
 * @param cwd - Working directory to look for custom skill (defaults to process.cwd())
 * @returns Full skill result including content, metadata, and path
 * @throws Error if skill cannot be found
 */
export function loadTaskChatSkill(cwd: string = process.cwd()): LoadSkillResult {
  return loadSkill(TASK_CHAT_SKILL, cwd)
}

/**
 * Get the allowed tools for the task chat skill.
 *
 * @param cwd - Working directory to look for custom skill (defaults to process.cwd())
 * @returns Array of allowed tool names, or undefined if not specified
 */
export function getTaskChatAllowedTools(cwd: string = process.cwd()): string[] | undefined {
  const result = loadSkill(TASK_CHAT_SKILL, cwd)
  return result.metadata.allowedTools
}

/**
 * Get the model for the task chat skill.
 *
 * @param cwd - Working directory to look for custom skill (defaults to process.cwd())
 * @returns Model name, or undefined if not specified
 */
export function getTaskChatModel(cwd: string = process.cwd()): string | undefined {
  const result = loadSkill(TASK_CHAT_SKILL, cwd)
  return result.metadata.model
}

// Re-export types for convenience
export type { LoadSkillResult, SkillMetadata }

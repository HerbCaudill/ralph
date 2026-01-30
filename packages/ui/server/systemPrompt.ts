import { loadSkill, type LoadSkillResult, type SkillMetadata } from "./loadSkill.js"

/** The skill used for task chat */
const TASK_CHAT_SKILL = "manage-tasks"

/**
 * Load the task chat system prompt from the manage-tasks skill.
 * Looks for a customized skill in the project's .claude/skills/ directory first,
 * then falls back to the bundled default skill if no customization exists.
 */
export function loadSystemPrompt(
  /** Working directory to look for custom skill (defaults to process.cwd()) */
  cwd: string = process.cwd(),
): string {
  const result = loadSkill(TASK_CHAT_SKILL, cwd)
  return result.content
}

/**  Load the full task chat skill with metadata. */
export function loadTaskChatSkill(
  /** Working directory to look for custom skill (defaults to process.cwd()) */
  cwd: string = process.cwd(),
): LoadSkillResult {
  return loadSkill(TASK_CHAT_SKILL, cwd)
}

/**  Get the allowed tools for the task chat skill. */
export function getTaskChatAllowedTools(
  /** Working directory to look for custom skill (defaults to process.cwd()) */
  cwd: string = process.cwd(),
): string[] | undefined {
  const result = loadSkill(TASK_CHAT_SKILL, cwd)
  return result.metadata.allowedTools
}

/**  Get the model for the task chat skill. */
export function getTaskChatModel(
  /** Working directory to look for custom skill (defaults to process.cwd()) */
  cwd: string = process.cwd(),
): string | undefined {
  const result = loadSkill(TASK_CHAT_SKILL, cwd)
  return result.metadata.model
}

export type { LoadSkillResult, SkillMetadata }

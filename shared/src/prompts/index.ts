/**
 * Prompt loading utilities.
 *
 * Provides consistent prompt loading behavior for CLI and server packages.
 */

export {
  // Generic prompt loading
  loadPrompt,
  initPrompt,
  getCustomPromptPath,
  hasCustomPrompt,
  type LoadPromptOptions,
  type LoadPromptResult,
  // Iteration prompt loading (core + workflow)
  loadIterationPrompt,
  hasCustomWorkflow,
  getCustomWorkflowPath,
  type LoadIterationPromptOptions,
  type LoadIterationPromptResult,
} from "./loadPrompt.js"

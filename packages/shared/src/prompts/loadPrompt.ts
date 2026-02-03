import { existsSync, readFileSync, copyFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { getWorkspaceRoot } from "./getWorkspaceRoot.js"

/** Placeholder in core prompt for workflow content */
const WORKFLOW_PLACEHOLDER = "{WORKFLOW}"

/**  Get the path to a custom prompt file. */
export function getCustomPromptPath(
  /** Configuration options */
  options: {
    filename: string
    customDir: string
    cwd?: string
  },
): string {
  const { filename, customDir, cwd = process.cwd() } = options
  return join(cwd, customDir, filename)
}

/**
 * Load a prompt file with fallback to default.
 *
 * First checks for a customized prompt in the custom directory.
 * Falls back to the default prompt if no customization exists.
 */
export function loadPrompt(
  /** Configuration for loading the prompt */
  options: LoadPromptOptions,
): LoadPromptResult {
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
 */
export function initPrompt(
  /** Configuration for initializing the prompt */
  options: LoadPromptOptions,
): {
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

/**  Check if a custom prompt file exists. */
export function hasCustomPrompt(
  /** Configuration options */
  options: {
    filename: string
    customDir: string
    cwd?: string
  },
): boolean {
  const customPath = getCustomPromptPath(options)
  return existsSync(customPath)
}

/**
 * Load the session prompt by combining core.prompt.md with workflow.prompt.md.
 *
 * The core prompt is always loaded from templates (bundled).
 * The workflow is loaded from .ralph/workflow.prompt.md if it exists, otherwise from templates.
 * The workflow content replaces {WORKFLOW} placeholder in the core prompt.
 */
export function loadSessionPrompt(
  /** Configuration for loading the prompt */
  options: LoadSessionPromptOptions,
): LoadSessionPromptResult {
  const { templatesDir, cwd = process.cwd() } = options
  const workspaceRoot = getWorkspaceRoot(cwd)

  // Load core prompt (always from templates)
  const corePromptPath = join(templatesDir, "core.prompt.md")
  if (!existsSync(corePromptPath)) {
    throw new Error(`Core prompt not found at ${corePromptPath}`)
  }
  const corePrompt = readFileSync(corePromptPath, "utf-8")

  // Try custom workflow first, then fall back to template
  const customWorkflowPath = join(workspaceRoot, ".ralph", "workflow.prompt.md")
  const defaultWorkflowPath = join(templatesDir, "workflow.prompt.md")

  let workflowContent: string
  let hasCustomWorkflow: boolean
  let workflowPath: string

  if (existsSync(customWorkflowPath)) {
    workflowContent = readFileSync(customWorkflowPath, "utf-8")
    hasCustomWorkflow = true
    workflowPath = customWorkflowPath
  } else if (existsSync(defaultWorkflowPath)) {
    workflowContent = readFileSync(defaultWorkflowPath, "utf-8")
    hasCustomWorkflow = false
    workflowPath = defaultWorkflowPath
  } else {
    throw new Error(`Workflow file not found at ${customWorkflowPath} or ${defaultWorkflowPath}`)
  }

  // Combine by replacing placeholder
  const content = corePrompt.replace(WORKFLOW_PLACEHOLDER, workflowContent)

  return {
    content,
    hasCustomWorkflow,
    workflowPath,
  }
}

/**  Check if a custom workflow exists. */
export function hasCustomWorkflow(
  /** Working directory (defaults to process.cwd()) */
  cwd: string = process.cwd(),
): boolean {
  return existsSync(join(getWorkspaceRoot(cwd), ".ralph", "workflow.prompt.md"))
}

/**  Get the path to the custom workflow file. */
export function getCustomWorkflowPath(
  /** Working directory (defaults to process.cwd()) */
  cwd: string = process.cwd(),
): string {
  return join(getWorkspaceRoot(cwd), ".ralph", "workflow.prompt.md")
}

/**  Configuration for loading a prompt file. */
export type LoadPromptOptions = {
  /** Name of the prompt file (e.g., "prompt.prompt.md" or "task-chat-system.prompt.md") */
  filename: string
  /** Path to the custom prompt directory (e.g., ".ralph") */
  customDir: string
  /** Path to the default prompt file */
  defaultPath: string
  /** Working directory to search for custom prompt (defaults to process.cwd()) */
  cwd?: string
}

/**  Result from loading a prompt file. */
export type LoadPromptResult = {
  /** The prompt content */
  content: string
  /** The path from which the prompt was loaded */
  path: string
  /** Whether the prompt was loaded from a custom location */
  isCustom: boolean
}

/**  Configuration for loading session prompts. */
export type LoadSessionPromptOptions = {
  /** Path to the templates directory containing core.prompt.md and workflow.prompt.md */
  templatesDir: string
  /** Working directory to search for custom workflow (defaults to process.cwd()) */
  cwd?: string
}

/**  Result from loading session prompt. */
export type LoadSessionPromptResult = {
  /** The combined prompt content (core + workflow) */
  content: string
  /** Whether a custom workflow was used */
  hasCustomWorkflow: boolean
  /** Path to the workflow file that was used */
  workflowPath: string
}

import { existsSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Parsed skill metadata from YAML frontmatter.
 */
export interface SkillMetadata {
  name: string
  description?: string
  userInvocation?: string
  model?: string
  allowedTools?: string[]
}

/**
 * Result from loading a skill file.
 */
export interface LoadSkillResult {
  /** The skill prompt content (without frontmatter) */
  content: string
  /** Parsed metadata from YAML frontmatter */
  metadata: SkillMetadata
  /** The path from which the skill was loaded */
  path: string
  /** Whether the skill was loaded from a custom location */
  isCustom: boolean
}

/**
 * Parse YAML frontmatter from a skill file.
 *
 * Frontmatter is delimited by --- at the start and end.
 */
function parseFrontmatter(content: string): { metadata: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { metadata: {}, body: content }
  }

  const [, frontmatterStr, body] = match
  const metadata: Record<string, unknown> = {}

  // Simple YAML parsing for the fields we care about
  for (const line of frontmatterStr.split("\n")) {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    // Handle arrays (lines starting with -)
    if (value === "") {
      // Check if next lines are array items
      continue
    }

    // Convert kebab-case to camelCase for common fields
    const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())

    metadata[camelKey] = value
  }

  // Parse allowed-tools as array
  const toolsMatch = frontmatterStr.match(/allowed-tools:\s*\n((?:\s+-\s+\S+\n?)+)/)
  if (toolsMatch) {
    const tools = toolsMatch[1]
      .split("\n")
      .map(line => line.replace(/^\s+-\s+/, "").trim())
      .filter(Boolean)
    metadata.allowedTools = tools
  }

  return { metadata, body: body.trim() }
}

/**
 * Load a skill file with fallback to default.
 * First checks for a customized skill in the project's .claude/skills/ directory.
 * Falls back to the bundled default skill if no customization exists.
 */
export function loadSkill(
  /** Name of the skill (e.g., "manage-tasks") */
  skillName: string,
  /** Working directory to look for custom skills (defaults to process.cwd()) */
  cwd: string = process.cwd(),
): LoadSkillResult {
  // Try custom skill location first
  const customPath = join(cwd, ".claude", "skills", skillName, "SKILL.md")

  if (existsSync(customPath)) {
    const content = readFileSync(customPath, "utf-8")
    const { metadata, body } = parseFrontmatter(content)

    return {
      content: body,
      metadata: {
        name: (metadata.name as string) || skillName,
        description: metadata.description as string | undefined,
        userInvocation: metadata.userInvocation as string | undefined,
        model: metadata.model as string | undefined,
        allowedTools: metadata.allowedTools as string[] | undefined,
      },
      path: customPath,
      isCustom: true,
    }
  }

  // Fall back to bundled default
  const defaultPath = join(__dirname, "prompts", "skills", skillName, "SKILL.md")

  if (existsSync(defaultPath)) {
    const content = readFileSync(defaultPath, "utf-8")
    const { metadata, body } = parseFrontmatter(content)

    return {
      content: body,
      metadata: {
        name: (metadata.name as string) || skillName,
        description: metadata.description as string | undefined,
        userInvocation: metadata.userInvocation as string | undefined,
        model: metadata.model as string | undefined,
        allowedTools: metadata.allowedTools as string[] | undefined,
      },
      path: defaultPath,
      isCustom: false,
    }
  }

  throw new Error(`Skill "${skillName}" not found at ${customPath} or ${defaultPath}`)
}

/**
 * Check if a custom skill exists.
 */
export function hasCustomSkill(skillName: string, cwd: string = process.cwd()): boolean {
  const customPath = join(cwd, ".claude", "skills", skillName, "SKILL.md")
  return existsSync(customPath)
}

/**
 * Get the path where a custom skill would be located.
 */
export function getCustomSkillPath(skillName: string, cwd: string = process.cwd()): string {
  return join(cwd, ".claude", "skills", skillName, "SKILL.md")
}

import { IconRobot } from "@tabler/icons-react"

/**
 * Displays agent name and model in the header.
 *
 * Shows the adapter display name (e.g., "Claude", "Codex") and optional model name
 * (e.g., "Sonnet 4"). Used in the app header alongside the workspace selector.
 */
export function HeaderAgentInfo({ agentDisplayName, modelName, textColor }: HeaderAgentInfoProps) {
  return (
    <div
      className="flex items-center gap-1.5 text-xs opacity-80"
      style={{ color: textColor }}
      data-testid="header-agent-info"
    >
      <IconRobot size={16} stroke={1.5} className="shrink-0" />
      <span>{agentDisplayName}</span>
      {modelName && <span className="opacity-70">({modelName})</span>}
    </div>
  )
}

export type HeaderAgentInfoProps = {
  /** Capitalized adapter display name (e.g., "Claude", "Codex"). */
  agentDisplayName: string
  /** Formatted model name (e.g., "Sonnet 4", "o3"). Null when unknown. */
  modelName: string | null
  /** Text color for contrast with header background. */
  textColor: string
}

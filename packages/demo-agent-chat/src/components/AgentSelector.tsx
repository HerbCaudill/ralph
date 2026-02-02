import { IconMessageChatbot, IconBrandOpenai } from "@tabler/icons-react"
import type { AgentType } from "../hooks/useAgentChat"

export type AgentSelectorProps = {
  value: AgentType
  onChange: (type: AgentType) => void
  disabled?: boolean
}

/**
 * Toggle buttons for selecting the agent backend (Claude Code or Codex).
 */
export function AgentSelector({
  value,
  onChange,
  disabled = false,
}: AgentSelectorProps) {
  const agents: { type: AgentType; label: string; icon: React.ReactNode }[] = [
    {
      type: "claude",
      label: "Claude Code",
      icon: <IconMessageChatbot size={16} stroke={1.5} />,
    },
    {
      type: "codex",
      label: "Codex",
      icon: <IconBrandOpenai size={16} stroke={1.5} />,
    },
  ]

  return (
    <div className="flex items-center gap-1">
      {agents.map(({ type, label, icon }) => {
        const isActive = value === type
        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            disabled={disabled}
            title={label}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            } disabled:opacity-50`}
          >
            {icon}
            {label}
          </button>
        )
      })}
    </div>
  )
}

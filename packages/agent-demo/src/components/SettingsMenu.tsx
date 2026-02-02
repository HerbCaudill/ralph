import { useState, useRef, useEffect } from "react"
import { IconSettings, IconMessageChatbot, IconBrandOpenai, IconCheck } from "@tabler/icons-react"
import type { AgentType } from "../hooks/useAgentChat"

/**
 * Settings dropdown menu with agent type selection.
 */
export function SettingsMenu({
  agentType,
  onAgentTypeChange,
  disabled = false,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  /** Close on outside click. */
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen])

  /** Close on Escape. */
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen])

  const agents: { type: AgentType; label: string; icon: React.ReactNode }[] = [
    { type: "claude", label: "Claude Code", icon: <IconMessageChatbot size={16} stroke={1.5} /> },
    { type: "codex", label: "Codex", icon: <IconBrandOpenai size={16} stroke={1.5} /> },
  ]

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
        className="flex items-center justify-center rounded-md border border-border p-1.5 transition-colors hover:bg-muted"
      >
        <IconSettings size={16} stroke={1.5} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-background shadow-md">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Agent</div>
          {agents.map(({ type, label, icon }) => {
            const isActive = agentType === type
            return (
              <button
                key={type}
                onClick={() => {
                  onAgentTypeChange(type)
                  setIsOpen(false)
                }}
                disabled={disabled}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                {icon}
                <span className="flex-1 text-left">{label}</span>
                {isActive && <IconCheck size={14} stroke={2} className="text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type SettingsMenuProps = {
  /** Currently selected agent type. */
  agentType: AgentType
  /** Callback when agent type changes. */
  onAgentTypeChange: (type: AgentType) => void
  /** Disable agent switching (e.g. while streaming). */
  disabled?: boolean
}

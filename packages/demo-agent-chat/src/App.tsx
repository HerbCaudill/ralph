import { IconMessageChatbot, IconBrandOpenai } from "@tabler/icons-react"
import { DemoShell } from "./components/DemoShell"

export function App() {
  return (
    <DemoShell
      title="Agent Chat Demo"
      subtitle="Claude Code + Codex"
      headerActions={<AgentSelector />}
    >
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <IconMessageChatbot size={48} stroke={1.5} />
          <p className="text-center text-sm">
            Select an agent and start chatting.
            <br />
            Agent chat UI will be implemented here.
          </p>
        </div>
      </div>
    </DemoShell>
  )
}

/** Placeholder agent type selector shown in the header */
function AgentSelector() {
  return (
    <div className="flex items-center gap-1">
      <button
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        title="Claude Code"
      >
        <IconMessageChatbot size={16} stroke={1.5} />
        Claude Code
      </button>
      <button
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        title="Codex"
      >
        <IconBrandOpenai size={16} stroke={1.5} />
        Codex
      </button>
    </div>
  )
}

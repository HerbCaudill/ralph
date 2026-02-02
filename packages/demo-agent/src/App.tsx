import { IconEraser, IconMessageChatbot } from "@tabler/icons-react"
import { AgentView, AgentViewProvider } from "@herbcaudill/agent-view"
import { DemoShell } from "./components/DemoShell"
import { AgentSelector } from "./components/AgentSelector"
import { ChatInput } from "./components/ChatInput"
import { StatusBar } from "./components/StatusBar"
import { useAgentChat } from "./hooks/useAgentChat"

export function App() {
  const { state, actions, agentType } = useAgentChat("claude")
  const { events, isStreaming, connectionStatus, error } = state
  const { sendMessage, clearHistory, setAgentType } = actions

  const isConnected = connectionStatus === "connected"

  return (
    <DemoShell
      title="Agent Chat Demo"
      headerActions={
        <div className="flex items-center gap-2">
          <AgentSelector value={agentType} onChange={setAgentType} disabled={isStreaming} />
          <button
            onClick={clearHistory}
            disabled={isStreaming || events.length === 0}
            title="Clear conversation"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-30"
          >
            <IconEraser size={16} stroke={1.5} />
            Clear
          </button>
        </div>
      }
      statusBar={
        <StatusBar
          connectionStatus={connectionStatus}
          isStreaming={isStreaming}
          agentType={agentType}
          events={events}
          error={error}
        />
      }
    >
      <div className="flex h-full flex-col">
        {/* Event display area */}
        <div className="min-h-0 flex-1">
          {events.length === 0 ?
            <div className="flex h-full items-center justify-center p-8">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <IconMessageChatbot size={48} stroke={1.5} />
                <p className="text-center text-sm">
                  {isConnected ?
                    "Select an agent and start chatting."
                  : "Connecting to agent server…"}
                </p>
              </div>
            </div>
          : <AgentViewProvider
              value={{ isDark: false, toolOutput: { isVisible: true, onToggle: () => {} } }}
            >
              <AgentView events={events} isStreaming={isStreaming} context={{ isDark: false }} />
            </AgentViewProvider>
          }
        </div>

        {/* Chat input */}
        <ChatInput
          onSend={sendMessage}
          disabled={!isConnected}
          isStreaming={isStreaming}
          placeholder={isConnected ? "Send a message…" : "Waiting for connection to agent server…"}
        />
      </div>
    </DemoShell>
  )
}

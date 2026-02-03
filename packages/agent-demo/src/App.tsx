import { useState, useCallback, useMemo, useRef } from "react"
import { IconMessageChatbot, IconPlus, IconLoader2 } from "@tabler/icons-react"
import {
  AgentView,
  AgentViewProvider,
  useAgentChat,
  useAgentHotkeys,
  SessionPicker,
  listSessions,
} from "@herbcaudill/agent-view"
import { DemoShell } from "./components/DemoShell"
import { SettingsMenu } from "./components/SettingsMenu"
import { ChatInput, type ChatInputHandle } from "./components/ChatInput"
import { HotkeysDialog } from "./components/HotkeysDialog"
import { StatusBar } from "./components/StatusBar"
import { useAdapterInfo, formatModelName } from "./hooks/useAdapterVersion"

export function App() {
  const { state, actions, agentType } = useAgentChat("claude")
  const { events, isStreaming, connectionStatus, error, sessionId } = state
  const { sendMessage, setAgentType, newSession, restoreSession } = actions

  // Session list for the SessionPicker — re-read on every render so it stays
  // in sync after newSession / restoreSession / sendMessage mutations.
  const sessions = useMemo(() => listSessions(), [sessionId, events.length])

  const handleSelectSession = useCallback(
    (id: string) => {
      restoreSession(id)
    },
    [restoreSession],
  )
  const { version: agentVersion, model } = useAdapterInfo(agentType)
  const modelName = formatModelName(model)
  const [showToolOutput, setShowToolOutput] = useState(true)

  // Refs for hotkey targets
  const chatInputRef = useRef<ChatInputHandle>(null)
  const eventContainerRef = useRef<HTMLDivElement>(null)

  // Hotkeys dialog state
  const [hotkeysDialogOpen, setHotkeysDialogOpen] = useState(false)

  // Hotkey handlers
  const handleFocusChatInput = useCallback(() => {
    chatInputRef.current?.focus()
  }, [])

  const handleNewSession = useCallback(() => {
    if (!isStreaming) {
      newSession()
    }
  }, [isStreaming, newSession])

  const handleToggleToolOutput = useCallback(() => {
    setShowToolOutput(prev => !prev)
  }, [])

  const handleScrollToBottom = useCallback(() => {
    const container = eventContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  const handleShowHotkeys = useCallback(() => {
    setHotkeysDialogOpen(true)
  }, [])

  // Register hotkeys
  const { registeredHotkeys } = useAgentHotkeys({
    handlers: {
      focusChatInput: handleFocusChatInput,
      newSession: handleNewSession,
      toggleToolOutput: handleToggleToolOutput,
      scrollToBottom: handleScrollToBottom,
      showHotkeys: handleShowHotkeys,
    },
  })

  const isConnected = connectionStatus === "connected"

  return (
    <>
      <DemoShell
        title="Agent Chat Demo"
        headerActions={
          <div className="flex items-center gap-2">
            <button
              onClick={newSession}
              disabled={isStreaming}
              title="New session"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-30"
            >
              <IconPlus size={16} stroke={1.5} />
              New session
            </button>
            <SessionPicker
              sessions={sessions}
              currentSessionId={sessionId}
              onSelectSession={handleSelectSession}
              disabled={isStreaming}
            />
            <SettingsMenu
              agentType={agentType}
              onAgentTypeChange={setAgentType}
              disabled={isStreaming}
            />
          </div>
        }
        statusBar={
          <StatusBar
            connectionStatus={connectionStatus}
            isStreaming={isStreaming}
            agentType={agentType}
            agentVersion={agentVersion}
            modelName={modelName}
            events={events}
            error={error}
            sessionId={sessionId}
          />
        }
      >
        <div className="flex h-full flex-col">
          {/* Event display area */}
          <div ref={eventContainerRef} className="min-h-0 flex-1 overflow-y-auto">
            {events.length === 0 ?
              <div className="flex h-full items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <IconMessageChatbot size={48} stroke={1.5} />
                  <p className="text-center text-sm">
                    {isConnected ?
                      "Start chatting with an AI agent."
                    : "Connecting to agent server…"}
                  </p>
                </div>
              </div>
            : <AgentViewProvider
                value={{
                  isDark: false,
                  toolOutput: {
                    isVisible: showToolOutput,
                    onToggle: () => setShowToolOutput(prev => !prev),
                  },
                }}
              >
                <AgentView
                  events={events}
                  isStreaming={isStreaming}
                  context={{ isDark: false }}
                  loadingIndicator={
                    isStreaming && (
                      <div className="flex justify-center py-4">
                        <IconLoader2 className="text-repo-accent size-6 animate-spin" />
                      </div>
                    )
                  }
                />
              </AgentViewProvider>
            }
          </div>

          {/* Chat input */}
          <ChatInput
            ref={chatInputRef}
            onSend={sendMessage}
            disabled={!isConnected}
            placeholder={
              isConnected ? "Send a message…" : "Waiting for connection to agent server…"
            }
          />
        </div>
      </DemoShell>
      <HotkeysDialog
        open={hotkeysDialogOpen}
        onClose={() => setHotkeysDialogOpen(false)}
        hotkeys={registeredHotkeys}
      />
    </>
  )
}

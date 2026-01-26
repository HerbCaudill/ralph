import { ChatInput, type ChatInputHandle } from "./chat/ChatInput"
import { EventStream } from "./events"
import { useAppStore, selectCanAcceptMessages, selectViewingSessionIndex } from "@/store"
import { useRalphConnection } from "@/hooks"

/**  Main agent view showing the event stream and chat input. */
export function AgentView({
  /** Ref to access ChatInput methods */
  chatInputRef,
}: AgentViewProps) {
  const { sendMessage, isConnected } = useRalphConnection()
  const canAcceptMessages = useAppStore(selectCanAcceptMessages)
  const viewingSessionIndex = useAppStore(selectViewingSessionIndex)
  const isViewingLatest = viewingSessionIndex === null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Event stream */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <EventStream />
      </div>

      {/* Chat input - only show when viewing the latest session */}
      {isViewingLatest && (
        <div className="border-border border-t p-4">
          <ChatInput
            ref={chatInputRef}
            onSubmit={sendMessage}
            disabled={!isConnected || !canAcceptMessages}
            placeholder={
              !isConnected ? "Connecting..."
              : !canAcceptMessages ?
                "Start Ralph to send messages..."
              : "Send a message..."
            }
          />
        </div>
      )}
    </div>
  )
}

interface AgentViewProps {
  chatInputRef?: React.RefObject<ChatInputHandle | null>
}

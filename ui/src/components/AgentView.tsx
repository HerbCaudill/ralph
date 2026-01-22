import { ChatInput, type ChatInputHandle } from "./chat/ChatInput"
import { EventStream } from "./events"
import { useAppStore, selectIsRalphRunning, selectViewingIterationIndex } from "@/store"
import { useRalphConnection } from "@/hooks"

/**
 * Main agent view showing the event stream and chat input.
 */
export function AgentView({
  /** Ref to access ChatInput methods */
  chatInputRef,
}: AgentViewProps) {
  const { sendMessage, isConnected } = useRalphConnection()
  const isRalphRunning = useAppStore(selectIsRalphRunning)
  const viewingIterationIndex = useAppStore(selectViewingIterationIndex)
  const isViewingLatest = viewingIterationIndex === null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Event stream */}
      <div className="min-h-0 flex-1">
        <EventStream />
      </div>

      {/* Chat input - only show when viewing the latest iteration */}
      {isViewingLatest && (
        <div className="border-border border-t p-4">
          <ChatInput
            ref={chatInputRef}
            onSubmit={sendMessage}
            disabled={!isConnected || !isRalphRunning}
            placeholder={
              !isConnected ? "Connecting..."
              : !isRalphRunning ?
                "Start Ralph to send messages..."
              : "Send Ralph a message..."
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

import { useState, useEffect } from "react"
import { ChatInput, type ChatInputHandle } from "./chat/ChatInput"
import { EventStream } from "./events"
import { useAppStore, selectCanAcceptMessages } from "@/store"
import { useRalphConnection, parseSessionIdFromUrl } from "@/hooks"

/**  Main agent view showing the event stream and chat input. */
export function AgentView({
  /** Ref to access ChatInput methods */
  chatInputRef,
}: AgentViewProps) {
  const { sendMessage, isConnected } = useRalphConnection()
  const canAcceptMessages = useAppStore(selectCanAcceptMessages)

  // Track whether we're viewing a historical session via URL
  const [isViewingLatest, setIsViewingLatest] = useState(
    () => parseSessionIdFromUrl(window.location) === null,
  )

  useEffect(() => {
    const handleUrlChange = () => {
      setIsViewingLatest(parseSessionIdFromUrl(window.location) === null)
    }
    // Listen for browser back/forward
    window.addEventListener("popstate", handleUrlChange)
    window.addEventListener("hashchange", handleUrlChange)
    // Listen for programmatic session URL changes (from useEventStream)
    window.addEventListener("session-url-change", handleUrlChange)
    return () => {
      window.removeEventListener("popstate", handleUrlChange)
      window.removeEventListener("hashchange", handleUrlChange)
      window.removeEventListener("session-url-change", handleUrlChange)
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Event stream */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <EventStream />
      </div>

      {/* Chat input - only show when viewing the latest session */}
      {isViewingLatest && (
        <div className="p-4">
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

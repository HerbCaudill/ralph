import { useCallback, useEffect } from "react"
import { useAppStore, selectConnectionStatus, selectIsConnected } from "../store"
import { ralphConnection, initRalphConnection } from "../lib/ralphConnection"

// Types

export interface UseRalphConnectionReturn {
  /**
   * Current connection status.
   */
  status: "disconnected" | "connecting" | "connected"

  /**
   * Whether the connection is currently open.
   */
  isConnected: boolean

  /**
   * Send a chat message to ralph via WebSocket.
   * The message will be forwarded to ralph's stdin.
   */
  sendMessage: (message: string) => void

  /**
   * Manually connect to the WebSocket server.
   */
  connect: () => void

  /**
   * Manually disconnect from the WebSocket server.
   */
  disconnect: () => void
}

// Hook

/**
 * Hook for accessing the Ralph WebSocket connection.
 * The actual connection is managed by a singleton that survives HMR.
 */
export function useRalphConnection(): UseRalphConnectionReturn {
  const status = useAppStore(selectConnectionStatus)
  const isConnected = useAppStore(selectIsConnected)

  // Initialize connection on first use
  useEffect(() => {
    initRalphConnection()
  }, [])

  const sendMessage = useCallback((message: string) => {
    ralphConnection.send({ type: "chat_message", message })
  }, [])

  const connect = useCallback(() => {
    ralphConnection.connect()
  }, [])

  const disconnect = useCallback(() => {
    ralphConnection.disconnect()
  }, [])

  return {
    status,
    isConnected,
    sendMessage,
    connect,
    disconnect,
  }
}

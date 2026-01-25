/**
 * Hook for managing task chat state and actions.
 *
 * Encapsulates store access and API calls for the task chat feature.
 * This is the data access layer for TaskChatController.
 */

import { TASK_CHAT_INPUT_DRAFT_STORAGE_KEY } from "@/constants"
import { clearTaskChatHistory } from "@/lib/clearTaskChatHistory"
import { sendTaskChatMessage } from "@/lib/sendTaskChatMessage"
import {
  selectIsConnected,
  selectTaskChatEvents,
  selectTaskChatLoading,
  selectTaskChatMessages,
  useAppStore,
} from "@/store"
import type { ChatEvent, TaskChatMessage } from "@/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/**
 * Converts TaskChatMessage objects to ChatEvent format for unified rendering.
 * Only converts user messages - assistant content comes from SDK events.
 */
function toChatEvents(userMessages: TaskChatMessage[], taskChatEvents: ChatEvent[]): ChatEvent[] {
  // Convert user TaskChatMessages to ChatEvent format
  const userEvents: ChatEvent[] = userMessages
    .filter(msg => msg.role === "user")
    .map(msg => ({
      type: "user_message",
      timestamp: msg.timestamp,
      message: msg.content,
    }))

  // Merge with task chat events and sort by timestamp
  return [...userEvents, ...taskChatEvents].sort((a, b) => a.timestamp - b.timestamp)
}

export interface UseTaskChatResult {
  /** All chat events (user messages + SDK events), sorted by timestamp */
  events: ChatEvent[]
  /** Whether a message is currently being processed */
  isLoading: boolean
  /** Whether the WebSocket is connected */
  isConnected: boolean
  /** Current error message, if any */
  error: string | null
  /** Send a message to the task chat */
  sendMessage: (message: string) => Promise<void>
  /** Clear chat history */
  clearHistory: () => Promise<void>
  /** Ref callback for focusing input after loading */
  onLoadingComplete: () => void
  /** Whether loading just completed (triggers focus) */
  loadingJustCompleted: boolean
  /** Storage key for persisting input drafts */
  storageKey: string
  /** Computed placeholder text based on state */
  placeholder: string
}

/**
 * Hook to manage task chat state and actions.
 *
 * Encapsulates:
 * - Store access (messages, events, loading state, connection status)
 * - API calls (send message, clear history)
 * - Message formatting (converting user messages to ChatEvent format)
 * - Loading timeout management
 */
export function useTaskChat(): UseTaskChatResult {
  // Store selectors
  const userMessages = useAppStore(selectTaskChatMessages)
  const taskChatEvents = useAppStore(selectTaskChatEvents)
  const isLoading = useAppStore(selectTaskChatLoading)
  const isConnected = useAppStore(selectIsConnected)

  // Store actions
  const addMessage = useAppStore(state => state.addTaskChatMessage)
  const removeMessage = useAppStore(state => state.removeTaskChatMessage)
  const setLoading = useAppStore(state => state.setTaskChatLoading)
  const clearMessages = useAppStore(state => state.clearTaskChatMessages)

  // Local state
  const [error, setError] = useState<string | null>(null)
  const [loadingJustCompleted, setLoadingJustCompleted] = useState(false)
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasLoadingRef = useRef(false)

  // Convert user messages to ChatEvent format and merge with task chat events
  const events = useMemo(
    () => toChatEvents(userMessages, taskChatEvents),
    [userMessages, taskChatEvents],
  )

  // Track loading completion for focus management
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      setLoadingJustCompleted(true)
    }
    wasLoadingRef.current = isLoading
  }, [isLoading])

  // Reset loadingJustCompleted after it's been used
  const onLoadingComplete = useCallback(() => {
    setLoadingJustCompleted(false)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [])

  // Clear timeout when loading stops
  useEffect(() => {
    if (!isLoading && loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }, [isLoading])

  /**
   * Send a message to the task chat.
   */
  const sendMessage = useCallback(
    async (message: string) => {
      const messageId = `user-${Date.now()}`
      setError(null)

      const userMessage: TaskChatMessage = {
        id: messageId,
        role: "user",
        content: message,
        timestamp: Date.now(),
      }
      addMessage(userMessage)
      setLoading(true)

      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }

      loadingTimeoutRef.current = setTimeout(() => {
        setLoading(false)
        loadingTimeoutRef.current = null
      }, 60_000)

      const result = await sendTaskChatMessage(message)

      if (!result.ok) {
        const errorMessage = result.error ?? "Failed to send message"
        const isAlreadyInProgress = errorMessage.toLowerCase().includes("already in progress")

        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
          loadingTimeoutRef.current = null
        }

        if (isAlreadyInProgress) {
          removeMessage(messageId)
          loadingTimeoutRef.current = setTimeout(() => {
            setLoading(false)
            loadingTimeoutRef.current = null
          }, 60_000)
          return
        }

        setLoading(false)
        setError(errorMessage)
      }
    },
    [addMessage, setLoading, removeMessage],
  )

  /**
   * Clear chat history.
   */
  const clearHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    const result = await clearTaskChatHistory()

    if (result.ok) {
      clearMessages()
    }
    setLoading(false)
  }, [clearMessages, setLoading])

  // Compute placeholder based on state
  const placeholder =
    !isConnected ? "Connecting..."
    : isLoading ? "Waiting for response..."
    : "How can I help?"

  return {
    events,
    isLoading,
    isConnected,
    error,
    sendMessage,
    clearHistory,
    onLoadingComplete,
    loadingJustCompleted,
    storageKey: TASK_CHAT_INPUT_DRAFT_STORAGE_KEY,
    placeholder,
  }
}

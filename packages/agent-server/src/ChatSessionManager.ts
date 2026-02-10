import { EventEmitter } from "node:events"
import { generateId } from "./lib/generateId.js"
import { SessionPersister } from "@herbcaudill/ralph-shared"
import {
  AgentAdapter,
  type AgentStartOptions,
  type ConversationContext,
  type ConversationMessage,
} from "./agentTypes.js"
import type { AgentEvent } from "@herbcaudill/ralph-shared"
import { createAdapter, isAdapterRegistered, registerDefaultAdapters } from "./AdapterRegistry.js"

/** Information about a chat session. */
export interface SessionInfo {
  /** Unique session identifier. */
  sessionId: string
  /** Agent adapter ID used for this session. */
  adapter: string
  /** Current status of the session. */
  status: "idle" | "processing" | "error"
  /** Working directory for this session. */
  cwd?: string
  /** When the session was created. */
  createdAt: number
  /** When the last message was sent. */
  lastMessageAt?: number
  /** App namespace for this session. */
  app?: string
  /** System prompt stored at session creation. */
  systemPrompt?: string
}

/** Options for creating a new session. */
export interface CreateSessionOptions {
  /** Agent adapter ID to use (defaults to first available). */
  adapter?: string
  /** Working directory for the agent. */
  cwd?: string
  /** App namespace for the session (e.g., "ralph", "task-chat"). */
  app?: string
  /** System prompt to store with the session (used as default for all messages). */
  systemPrompt?: string
}

/** Options for sending a message. */
export interface SendMessageOptions {
  /** System prompt to use for this message (per-message, no default). */
  systemPrompt?: string
  /** Model override. */
  model?: string
  /** Whether this message is a system/workflow prompt (should be hidden from display). */
  isSystemPrompt?: boolean
}

/** Events emitted by ChatSessionManager. */
export interface ChatSessionManagerEvents {
  /** An agent event was emitted for a session. */
  event: (sessionId: string, event: AgentEvent) => void
  /** Session status changed. */
  status: (sessionId: string, status: string) => void
  /** An error occurred. */
  error: (sessionId: string, error: Error) => void
}

/** Options for constructing a ChatSessionManager. */
export interface ChatSessionManagerOptions {
  /** Directory to store session JSONL files. */
  storageDir: string
  /** Default working directory for agents. */
  cwd?: string
}

/**
 * Manages chat sessions using agent adapters.
 * No built-in system prompt — clients provide it per-message if desired.
 */
export class ChatSessionManager extends EventEmitter {
  private sessions = new Map<string, SessionState>()
  private persister: SessionPersister
  private defaultCwd: string

  constructor(
    /** Configuration options. */
    options: ChatSessionManagerOptions,
  ) {
    super()
    this.persister = new SessionPersister(options.storageDir)
    this.defaultCwd = options.cwd ?? process.cwd()

    // Ensure default adapters are registered
    registerDefaultAdapters()

    // Restore sessions from disk
    this.restoreSessions()
  }

  /** Create a new chat session. */
  async createSession(
    /** Options for the new session. */
    options: CreateSessionOptions = {},
  ): Promise<{ sessionId: string }> {
    const adapter = options.adapter ?? "claude"
    if (!isAdapterRegistered(adapter)) {
      throw new Error(`Unknown adapter "${adapter}".`)
    }
    const tempAdapter = createAdapter(adapter)
    if (!(await tempAdapter.isAvailable())) {
      throw new Error(
        `The "${adapter}" adapter is not available. ` +
          (adapter === "claude" ?
            `Ensure the Claude CLI is installed.`
          : `Check your configuration.`),
      )
    }

    const sessionId = generateId()
    const session: SessionState = {
      sessionId,
      adapter,
      status: "idle",
      cwd: options.cwd ?? this.defaultCwd,
      createdAt: Date.now(),
      adapterInstance: null,
      conversationContext: {
        messages: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        timestamp: Date.now(),
      },
      messageQueue: [],
      app: options.app,
      systemPrompt: options.systemPrompt,
    }

    this.sessions.set(sessionId, session)

    // Persist creation event
    await this.persister.appendEvent(
      sessionId,
      {
        type: "session_created",
        sessionId,
        adapter,
        cwd: session.cwd,
        app: options.app,
        systemPrompt: options.systemPrompt,
        timestamp: Date.now(),
      },
      options.app,
    )

    return { sessionId }
  }

  /** Send a message to a session. */
  async sendMessage(
    /** The session ID. */
    sessionId: string,
    /** The user's message. */
    message: string,
    /** Options including optional system prompt. */
    options: SendMessageOptions = {},
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // If already processing, queue the message and return a promise
    if (session.status === "processing") {
      return new Promise<void>((resolve, reject) => {
        session.messageQueue.push({ message, options, resolve, reject })
      })
    }

    await this.processMessage(session, message, options)
  }

  /** Process a single message and then process any queued messages. */
  private async processMessage(
    session: SessionState,
    message: string,
    options: SendMessageOptions,
  ): Promise<void> {
    const sessionId = session.sessionId

    session.status = "processing"
    session.lastMessageAt = Date.now()
    this.emit("status", sessionId, "processing")

    // Persist user message as a generic record (not a typed AgentEvent)
    const userEvent: Record<string, unknown> = {
      type: "user_message",
      message,
      timestamp: Date.now(),
      ...(options.isSystemPrompt ? { isSystemPrompt: true } : {}),
    }
    await this.persister.appendEvent(sessionId, userEvent, session.app)
    this.emit("event", sessionId, userEvent)

    // Create adapter if needed
    if (!session.adapterInstance) {
      session.adapterInstance = createAdapter(session.adapter)
    }

    const adapter = session.adapterInstance

    // Wire up event forwarding
    const onEvent = async (event: AgentEvent) => {
      await this.persister.appendEvent(sessionId, event, session.app)
      this.emit("event", sessionId, event)
    }

    const onError = (err: Error) => {
      session.status = "error"
      this.emit("error", sessionId, err)
      this.emit("status", sessionId, "error")
    }

    adapter.on("event", onEvent)
    adapter.on("error", onError)

    try {
      // Build start options (per-message systemPrompt overrides session-level)
      const startOptions: AgentStartOptions = {
        cwd: session.cwd,
        systemPrompt: options.systemPrompt ?? session.systemPrompt,
        model: options.model,
      }

      // If adapter isn't running, start it
      if (!adapter.isRunning) {
        await adapter.start(startOptions)
      }

      // Send the user message
      adapter.send({ type: "user_message", content: message })

      // Wait for the adapter to finish processing
      await new Promise<void>((resolve, reject) => {
        const onStatus = (status: string) => {
          if (status === "idle" || status === "stopped") {
            cleanup()
            resolve()
          }
        }

        const onExit = () => {
          cleanup()
          resolve()
        }

        const onErr = (err: Error) => {
          cleanup()
          reject(err)
        }

        const cleanup = () => {
          adapter.off("status", onStatus)
          adapter.off("exit", onExit)
          adapter.off("error", onErr)
        }

        adapter.on("status", onStatus)
        adapter.on("exit", onExit)
        adapter.on("error", onErr)
      })

      // Process next queued message if any
      await this.processQueue(session)
    } catch (err) {
      session.status = "error"
      this.emit("error", sessionId, err as Error)
      this.emit("status", sessionId, "error")

      // Reject all queued messages on error
      this.rejectQueue(session, err as Error)
    } finally {
      adapter.off("event", onEvent)
      adapter.off("error", onError)
    }
  }

  /** Process the next message in the queue, or set status to idle if empty. */
  private async processQueue(session: SessionState): Promise<void> {
    const next = session.messageQueue.shift()
    if (next) {
      try {
        await this.processMessage(session, next.message, next.options)
        next.resolve()
      } catch (err) {
        next.reject(err as Error)
      }
    } else {
      session.status = "idle"
      this.emit("status", session.sessionId, "idle")
    }
  }

  /** Reject all queued messages with an error. */
  private rejectQueue(session: SessionState, error: Error): void {
    for (const queued of session.messageQueue) {
      queued.reject(error)
    }
    session.messageQueue = []
  }

  /** Get info about a session. */
  getSessionInfo(
    /** The session ID. */
    sessionId: string,
  ): SessionInfo | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return {
      sessionId: session.sessionId,
      adapter: session.adapter,
      status: session.status,
      cwd: session.cwd,
      createdAt: session.createdAt,
      lastMessageAt: session.lastMessageAt,
      app: session.app,
      systemPrompt: session.systemPrompt,
    }
  }

  /**
   * List all sessions, optionally filtered by app.
   * @param app If provided, only return sessions for this app.
   */
  listSessions(app?: string): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter(s => app === undefined || s.app === app)
      .map(s => ({
        sessionId: s.sessionId,
        adapter: s.adapter,
        status: s.status,
        cwd: s.cwd,
        createdAt: s.createdAt,
        lastMessageAt: s.lastMessageAt,
        app: s.app,
        systemPrompt: s.systemPrompt,
      }))
  }

  /** Clear a session (stop adapter, remove from memory, delete persisted data). */
  async clearSession(
    /** The session ID. */
    sessionId: string,
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session?.adapterInstance?.isRunning) {
      await session.adapterInstance.stop()
    }
    this.sessions.delete(sessionId)
    this.persister.deleteSession(sessionId, session?.app)
  }

  /**
   * Interrupt the current query for a session.
   * Sends an interrupt control message to the adapter if it's running.
   */
  async interruptSession(
    /** The session ID. */
    sessionId: string,
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    if (session.adapterInstance?.isRunning) {
      session.adapterInstance.send({ type: "control", command: "interrupt" })
    }
  }

  /** Get the persister for direct event access. */
  getPersister(): SessionPersister {
    return this.persister
  }

  /** Restore sessions from persisted JSONL files. */
  private restoreSessions(): void {
    const sessions = this.persister.listSessionsWithApp()
    for (const { sessionId, app } of sessions) {
      // Read creation event to get accurate metadata (pass app to find the file)
      const metadata = this.persister.readSessionMetadata(sessionId, app)

      this.sessions.set(sessionId, {
        sessionId,
        adapter: metadata?.adapter ?? "claude",
        status: "idle",
        cwd: metadata?.cwd ?? this.defaultCwd,
        createdAt: metadata?.createdAt ?? 0,
        adapterInstance: null,
        conversationContext: {
          messages: [],
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          timestamp: Date.now(),
        },
        messageQueue: [],
        app,
        systemPrompt: metadata?.systemPrompt,
      })
    }
  }
}

/** A queued message waiting to be processed. */
interface QueuedMessage {
  message: string
  options: SendMessageOptions
  resolve: () => void
  reject: (error: Error) => void
}

/** Internal session state. */
interface SessionState {
  sessionId: string
  adapter: string
  status: "idle" | "processing" | "error"
  cwd?: string
  createdAt: number
  lastMessageAt?: number
  adapterInstance: AgentAdapter | null
  conversationContext: ConversationContext
  /** Queue of messages waiting to be processed. */
  messageQueue: QueuedMessage[]
  /** App namespace for this session. */
  app?: string
  /** System prompt stored at session creation. */
  systemPrompt?: string
}

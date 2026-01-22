import { createConnection, Socket } from "net"
import { join } from "path"
import { existsSync } from "fs"
import type { MutationEvent } from "@herbcaudill/ralph-shared"

/**
 * Re-export MutationEvent for backward compatibility
 */
export type { MutationEvent } from "@herbcaudill/ralph-shared"

const SOCKET_PATH = join(process.cwd(), ".beads", "bd.sock")

type RPCRequest = {
  operation: string
  args: Record<string, unknown>
}

type RPCResponse = {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Simple RPC client for beads daemon.
 * Connects to .beads/bd.sock and sends JSON-over-newline requests.
 */
export class BeadsClient {
  private socket: Socket | null = null
  private connected = false

  /**
   * Check if the beads daemon socket exists.
   */
  static socketExists(): boolean {
    return existsSync(SOCKET_PATH)
  }

  /**
   * Connect to the beads daemon.
   */
  async connect(): Promise<boolean> {
    if (!BeadsClient.socketExists()) {
      return false
    }

    return new Promise(resolve => {
      this.socket = createConnection(SOCKET_PATH)

      const timeout = setTimeout(() => {
        this.socket?.destroy()
        this.socket = null
        resolve(false)
      }, 2000)

      this.socket.on("connect", () => {
        clearTimeout(timeout)
        this.connected = true
        resolve(true)
      })

      this.socket.on("error", () => {
        clearTimeout(timeout)
        this.socket = null
        resolve(false)
      })
    })
  }

  /**
   * Send an RPC request and wait for response.
   */
  private async execute<T>(
    operation: string,
    args: Record<string, unknown> = {},
  ): Promise<T | null> {
    if (!this.socket || !this.connected) {
      return null
    }

    return new Promise(resolve => {
      const request: RPCRequest = { operation, args }
      const requestLine = JSON.stringify(request) + "\n"

      let responseData = ""

      const onData = (chunk: Buffer) => {
        responseData += chunk.toString()
        if (responseData.includes("\n")) {
          cleanup()
          try {
            const response: RPCResponse = JSON.parse(responseData.trim())
            if (response.success && response.data) {
              resolve(response.data as T)
            } else {
              resolve(null)
            }
          } catch {
            resolve(null)
          }
        }
      }

      const onError = () => {
        cleanup()
        resolve(null)
      }

      const timeout = setTimeout(() => {
        cleanup()
        resolve(null)
      }, 5000)

      const cleanup = () => {
        clearTimeout(timeout)
        this.socket?.off("data", onData)
        this.socket?.off("error", onError)
      }

      this.socket!.on("data", onData)
      this.socket!.on("error", onError)
      this.socket!.write(requestLine)
    })
  }

  /**
   * Get mutations since a given timestamp.
   */
  async getMutations(
    /** Unix timestamp in milliseconds (0 for all recent) */
    since: number = 0,
  ): Promise<MutationEvent[]> {
    const result = await this.execute<MutationEvent[]>("get_mutations", { since })
    return result ?? []
  }

  /**
   * Get ready issues (no blockers).
   */
  async getReady(): Promise<{ id: string; title: string }[]> {
    const result = await this.execute<{ id: string; title: string }[]>("ready", {})
    return result ?? []
  }

  /**
   * Close the connection.
   */
  close(): void {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
      this.connected = false
    }
  }
}

/**
 * Poll for new issue creation events.
 * Returns a cleanup function.
 */
export function watchForNewIssues(
  onNewIssue: (issue: MutationEvent) => void,
  interval: number = 5000,
): () => void {
  let lastTimestamp = Date.now()
  let client: BeadsClient | null = null
  let timeoutId: NodeJS.Timeout | null = null
  let stopped = false

  const poll = async () => {
    if (stopped) return

    if (!client) {
      client = new BeadsClient()
      const connected = await client.connect()
      if (!connected) {
        // Retry connection later
        timeoutId = setTimeout(poll, interval)
        return
      }
    }

    try {
      const mutations = await client.getMutations(lastTimestamp)

      for (const mutation of mutations) {
        if (mutation.Type === "create") {
          onNewIssue(mutation)
        }
        // Update timestamp to avoid re-processing
        const mutationTime = new Date(mutation.Timestamp).getTime()
        if (mutationTime > lastTimestamp) {
          lastTimestamp = mutationTime
        }
      }
    } catch {
      // Connection may have been lost, reset client
      client?.close()
      client = null
    }

    if (!stopped) {
      timeoutId = setTimeout(poll, interval)
    }
  }

  // Start polling
  poll()

  // Return cleanup function
  return () => {
    stopped = true
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    client?.close()
  }
}

import type { Express, Request, Response } from "express"
import type { AgentRouteContext } from "./types.js"

/**
 * Register task chat routes on an Express app.
 *
 * Routes:
 * - POST /api/task-chat/message
 * - GET  /api/task-chat/messages
 * - POST /api/task-chat/clear
 * - POST /api/task-chat/cancel
 * - GET  /api/task-chat/status
 */
export function registerTaskChatRoutes(app: Express, ctx: AgentRouteContext): void {
  app.post("/api/task-chat/message", (req: Request, res: Response) => {
    try {
      const { message } = req.body as {
        message?: string
      }

      if (!message?.trim()) {
        res.status(400).json({ ok: false, error: "Message is required" })
        return
      }

      const taskChatManager = ctx.getTaskChatManager()

      if (taskChatManager.isProcessing) {
        res.status(409).json({ ok: false, error: "A request is already in progress" })
        return
      }

      // Fire and forget - response comes via WebSocket
      taskChatManager.sendMessage(message.trim()).catch(err => {
        console.error("[task-chat] Error sending message:", err)
      })

      res.status(202).json({
        ok: true,
        status: "processing",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message"
      res.status(500).json({ ok: false, error: msg })
    }
  })

  app.get("/api/task-chat/messages", (_req: Request, res: Response) => {
    try {
      const taskChatManager = ctx.getTaskChatManager()
      res.status(200).json({
        ok: true,
        messages: [],
        status: taskChatManager.status,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get messages"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/task-chat/clear", (_req: Request, res: Response) => {
    try {
      const taskChatManager = ctx.getTaskChatManager()
      taskChatManager.clearHistory()
      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear history"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/task-chat/cancel", (_req: Request, res: Response) => {
    try {
      const taskChatManager = ctx.getTaskChatManager()
      taskChatManager.cancel()
      res.status(200).json({ ok: true, status: taskChatManager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel request"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.get("/api/task-chat/status", (_req: Request, res: Response) => {
    try {
      const taskChatManager = ctx.getTaskChatManager()
      res.status(200).json({
        ok: true,
        status: taskChatManager.status,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get status"
      res.status(500).json({ ok: false, error: message })
    }
  })
}

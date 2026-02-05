import type { Request, Response } from "express"
import { loadRalphPrompt } from "../lib/loadRalphPrompt.js"

/**
 * GET /api/prompts/ralph
 * Returns the Ralph session prompt content (core.prompt.md + workflow.prompt.md).
 * This is sent as the first user message to start the Ralph session (like the CLI does).
 */
export async function getRalphPrompt(req: Request, res: Response): Promise<void> {
  try {
    const cwd = (req.query.cwd as string) || process.cwd()
    const promptContent = await loadRalphPrompt(cwd)

    // Return the prompt content that should be sent as the first user message
    res.json({ prompt: promptContent })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}

import { EventEmitter } from "node:events"
import { query } from "@anthropic-ai/claude-agent-sdk"

// Types

export interface TitlingResult {
  title: string
  description: string
}

export interface TaskTitlingServiceOptions {
  /** Model to use (default: "haiku" for fast, cheap responses) */
  model?: string
  /** Request timeout in ms (default: 30000 = 30 seconds) */
  timeout?: number
  /** Override API key (optional) */
  apiKey?: string
}

// TaskTitlingService

/**
 * Service that uses Claude to parse user input and extract a concise title
 * and move details to description.
 *
 * Events emitted:
 * - "result" - Successful titling result
 * - "error" - Error during titling
 */
export class TaskTitlingService extends EventEmitter {
  private options: {
    model: string
    timeout: number
    apiKey?: string
  }

  constructor(options: TaskTitlingServiceOptions = {}) {
    super()
    this.options = {
      model: options.model ?? "haiku",
      timeout: options.timeout ?? 30000, // 30 second default
      apiKey: options.apiKey,
    }
  }

  /**
   * Parse task text and extract a concise title and description.
   *
   * @param taskText - The raw task text entered by the user
   * @returns Promise that resolves with title and description
   */
  async parseTask(taskText: string): Promise<TitlingResult> {
    if (!taskText?.trim()) {
      throw new Error("Task text is required")
    }

    const systemPrompt = this.buildSystemPrompt()
    const userPrompt = this.buildUserPrompt(taskText)

    // Set up timeout and abort controller
    const timeoutMs = this.options.timeout
    const abortController = new AbortController()
    const timeoutTimer = setTimeout(() => {
      abortController.abort()
    }, timeoutMs)

    try {
      // Configure environment for query
      const env: Record<string, string> = {}
      if (this.options.apiKey) {
        env.ANTHROPIC_API_KEY = this.options.apiKey
      }

      let responseText = ""

      // Use SDK query() as async generator
      for await (const message of query({
        prompt: userPrompt,
        options: {
          model: this.options.model,
          systemPrompt,
          tools: [], // No tools needed
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          includePartialMessages: true, // Enable streaming
          maxTurns: 1, // Single turn for title extraction
          abortController,
          env,
        },
      })) {
        // Collect text from streaming response
        if (message.type === "stream_event" && message.event.type === "content_block_delta") {
          const delta = message.event.delta
          if (delta.type === "text_delta" && delta.text) {
            responseText += delta.text
          }
        }

        // Also handle complete assistant messages
        if (message.type === "assistant" && message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === "text" && block.text) {
              responseText = block.text
            }
          }
        }

        // Check for error results
        if (message.type === "result" && message.subtype !== "success") {
          const error = new Error(`Task titling failed: ${message.subtype}`)
          this.emit("error", error)
          throw error
        }
      }

      clearTimeout(timeoutTimer)

      // Parse the response to extract title and description
      const result = this.parseResponse(responseText, taskText)
      this.emit("result", result)
      return result
    } catch (err) {
      clearTimeout(timeoutTimer)

      // Handle abort/timeout
      if (err instanceof Error && err.name === "AbortError") {
        const error = new Error(`Task titling timed out after ${timeoutMs}ms`)
        this.emit("error", error)
        throw error
      }

      // Re-throw other errors
      const error = err instanceof Error ? err : new Error("Failed to parse task")
      this.emit("error", error)
      throw error
    }
  }

  /**
   * Build the system prompt for Claude.
   */
  private buildSystemPrompt(): string {
    return `You are a task title extraction assistant. Your job is to analyze user input and extract a concise title and detailed description.

Rules:
1. The title should be SHORT and concise (max 50 characters ideally)
2. The title should capture the essence of the task
3. The title should be in imperative form (e.g., "Add dark mode", not "Adding dark mode")
4. Move ALL details, context, and specifics to the description
5. If the input is already concise (< 60 chars), use it as the title with an empty description
6. If the input contains multiple sentences, the first part becomes the title and the rest becomes the description

You MUST respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{"title": "Concise task title", "description": "Detailed description or empty string"}

Examples:
Input: "Add dark mode toggle to settings"
Output: {"title": "Add dark mode toggle to settings", "description": ""}

Input: "Add dark mode toggle to settings. It should be in the user preferences section and persist across sessions. Use the system theme by default."
Output: {"title": "Add dark mode toggle to settings", "description": "It should be in the user preferences section and persist across sessions. Use the system theme by default."}

Input: "Fix the bug where clicking the submit button twice causes duplicate submissions. This happens on the contact form page. We need to disable the button after the first click."
Output: {"title": "Fix duplicate submission bug on contact form", "description": "Clicking the submit button twice causes duplicate submissions. This happens on the contact form page. We need to disable the button after the first click."}

Remember: Respond with ONLY the JSON object, nothing else.`
  }

  /**
   * Build the user prompt with the task text.
   */
  private buildUserPrompt(taskText: string): string {
    return `Extract a concise title and description from this task:\n\n${taskText}`
  }

  /**
   * Parse Claude's response to extract title and description.
   * Falls back to using the original text as title if parsing fails.
   */
  private parseResponse(responseText: string, originalText: string): TitlingResult {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // Fallback: use original text as title if no JSON found
      return {
        title: originalText.slice(0, 100), // Cap at 100 chars
        description: "",
      }
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as { title?: string; description?: string }

      if (!parsed.title) {
        // Fallback if title is missing
        return {
          title: originalText.slice(0, 100),
          description: "",
        }
      }

      return {
        title: parsed.title.trim(),
        description: (parsed.description || "").trim(),
      }
    } catch {
      // Fallback: use original text as title if JSON parsing fails
      return {
        title: originalText.slice(0, 100),
        description: "",
      }
    }
  }
}

import { rel } from "../lib/rel.js"
import { shortenTempPaths } from "../lib/shortenTempPaths.js"

/**
 * Transform an event from the Claude SDK into display blocks.
 * Extracts text content and tool use information from assistant and user messages.
 */
export const eventToBlocks = (
  /** The event object from Claude SDK containing message data */
  event: Record<string, unknown>,
): ContentBlock[] => {
  // Handle user messages
  if (event.type === "user") {
    const message = event.message as Record<string, unknown> | undefined
    const content = message?.content as Array<Record<string, unknown>> | undefined
    const messageId = (message?.id as string | undefined) ?? `user-${Date.now()}`

    if (!content) {
      return []
    }

    // Extract text from user message content
    const textContent = content
      .filter(block => block.type === "text")
      .map(block => block.text as string)
      .join("")

    if (textContent) {
      return [{ type: "user", content: textContent, id: messageId }]
    }
    return []
  }

  if (event.type !== "assistant") {
    return []
  }

  const message = event.message as Record<string, unknown> | undefined
  const content = message?.content as Array<Record<string, unknown>> | undefined

  if (!content) {
    return []
  }

  const blocks: ContentBlock[] = []
  const messageId = (message?.id as string | undefined) ?? "unknown"
  let blockIndex = 0

  let textBuffer = "" // Accumulate consecutive text blocks

  for (const block of content) {
    if (block.type === "text") {
      const text = block.text as string | undefined
      if (text) {
        textBuffer += text
      }
    } else if (block.type === "tool_use") {
      // Flush accumulated text before processing tool
      if (textBuffer) {
        blocks.push({ type: "text", content: textBuffer, id: `${messageId}-${blockIndex++}` })
        textBuffer = ""
      }
      const input = block.input as Record<string, unknown> | undefined
      const name = block.name as string

      if (name === "Read") {
        const filePath = input?.file_path as string | undefined
        if (filePath) {
          blocks.push({
            type: "tool",
            name: "Read",
            arg: rel(filePath),
            id: `${messageId}-${blockIndex++}`,
          })
        }
      } else if (name === "Edit" || name === "Write") {
        const filePath = input?.file_path as string | undefined
        if (filePath) {
          blocks.push({
            type: "tool",
            name,
            arg: rel(filePath),
            id: `${messageId}-${blockIndex++}`,
          })
        }
      } else if (name === "Bash") {
        const command = input?.command as string | undefined
        if (command) {
          blocks.push({
            type: "tool",
            name: "$",
            arg: shortenTempPaths(command),
            id: `${messageId}-${blockIndex++}`,
          })
        }
      } else if (name === "Grep") {
        const pattern = input?.pattern as string | undefined
        const path = input?.path as string | undefined
        blocks.push({
          type: "tool",
          name: "Grep",
          arg: `${pattern}${path ? ` in ${rel(path)}` : ""}`,
          id: `${messageId}-${blockIndex++}`,
        })
      } else if (name === "Glob") {
        const pattern = input?.pattern as string | undefined
        const path = input?.path as string | undefined
        blocks.push({
          type: "tool",
          name: "Glob",
          arg: `${pattern}${path ? ` in ${rel(path)}` : ""}`,
          id: `${messageId}-${blockIndex++}`,
        })
      } else if (name === "TodoWrite") {
        const todos = input?.todos as Array<{ content: string; status: string }> | undefined
        if (todos?.length) {
          const summary = todos
            .map(
              t =>
                `[${
                  t.status === "completed" ? "x"
                  : t.status === "in_progress" ? "~"
                  : " "
                }] ${t.content}`,
            )
            .join("\n    ")
          blocks.push({
            type: "tool",
            name: "TodoWrite",
            arg: "\n    " + summary,
            id: `${messageId}-${blockIndex++}`,
          })
        } else {
          blocks.push({ type: "tool", name: "TodoWrite", id: `${messageId}-${blockIndex++}` })
        }
      } else if (name === "WebFetch") {
        const url = input?.url as string | undefined
        blocks.push({
          type: "tool",
          name: "WebFetch",
          arg: url,
          id: `${messageId}-${blockIndex++}`,
        })
      } else if (name === "WebSearch") {
        const query = input?.query as string | undefined
        blocks.push({
          type: "tool",
          name: "WebSearch",
          arg: query,
          id: `${messageId}-${blockIndex++}`,
        })
      } else if (name === "Task") {
        const description = input?.description as string | undefined
        blocks.push({
          type: "tool",
          name: "Task",
          arg: description,
          id: `${messageId}-${blockIndex++}`,
        })
      } else if (name === "Skill") {
        const skill = input?.skill as string | undefined
        blocks.push({ type: "tool", name: "Skill", arg: skill, id: `${messageId}-${blockIndex++}` })
      }
    }
  }

  // Flush any remaining text at the end
  if (textBuffer) {
    blocks.push({ type: "text", content: textBuffer, id: `${messageId}-${blockIndex++}` })
  }

  return blocks
}

export type ContentBlock =
  | { type: "text"; content: string; id: string }
  | { type: "tool"; name: string; arg?: string; id: string }
  | { type: "user"; content: string; id: string }

import { rel } from "../lib/rel.js"
import { shortenTempPaths } from "../lib/shortenTempPaths.js"

export type ContentBlock =
  | { type: "text"; content: string }
  | { type: "tool"; name: string; arg?: string }

export const eventToBlocks = (event: Record<string, unknown>): ContentBlock[] => {
  if (event.type !== "assistant") {
    return []
  }

  const message = event.message as Record<string, unknown> | undefined
  const content = message?.content as Array<Record<string, unknown>> | undefined

  if (!content) {
    return []
  }

  const blocks: ContentBlock[] = []

  for (const block of content) {
    if (block.type === "text") {
      const text = block.text as string | undefined
      if (text) {
        blocks.push({ type: "text", content: text })
      }
    } else if (block.type === "tool_use") {
      const input = block.input as Record<string, unknown> | undefined
      const name = block.name as string

      if (name === "Read") {
        const filePath = input?.file_path as string | undefined
        if (filePath) {
          blocks.push({ type: "tool", name: "Read", arg: rel(filePath) })
        }
      } else if (name === "Edit" || name === "Write") {
        const filePath = input?.file_path as string | undefined
        if (filePath) {
          blocks.push({ type: "tool", name, arg: rel(filePath) })
        }
      } else if (name === "Bash") {
        const command = input?.command as string | undefined
        if (command) {
          blocks.push({ type: "tool", name: "$", arg: shortenTempPaths(command) })
        }
      } else if (name === "Grep") {
        const pattern = input?.pattern as string | undefined
        const path = input?.path as string | undefined
        blocks.push({
          type: "tool",
          name: "Grep",
          arg: `${pattern}${path ? ` in ${rel(path)}` : ""}`,
        })
      } else if (name === "Glob") {
        const pattern = input?.pattern as string | undefined
        const path = input?.path as string | undefined
        blocks.push({
          type: "tool",
          name: "Glob",
          arg: `${pattern}${path ? ` in ${rel(path)}` : ""}`,
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
          blocks.push({ type: "tool", name: "TodoWrite", arg: "\n    " + summary })
        } else {
          blocks.push({ type: "tool", name: "TodoWrite" })
        }
      } else if (name === "WebFetch") {
        const url = input?.url as string | undefined
        blocks.push({ type: "tool", name: "WebFetch", arg: url })
      } else if (name === "WebSearch") {
        const query = input?.query as string | undefined
        blocks.push({ type: "tool", name: "WebSearch", arg: query })
      } else if (name === "Task") {
        const description = input?.description as string | undefined
        blocks.push({ type: "tool", name: "Task", arg: description })
      } else if (name === "Skill") {
        const skill = input?.skill as string | undefined
        blocks.push({ type: "tool", name: "Skill", arg: skill })
      }
    }
  }

  return blocks
}

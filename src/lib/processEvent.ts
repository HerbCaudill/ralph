import { rel } from "./rel.js"
import { shortenTempPaths } from "./shortenTempPaths.js"
import { flushLine, writeWrappedText } from "./textFormatting.js"
import { showToolUse } from "./showToolUse.js"
import { outputState } from "./outputState.js"

const toolIndent = "  "

export const processEvent = (event: Record<string, unknown>) => {
  // Stream text deltas as they come in
  if (event.type === "stream_event") {
    const streamEvent = event.event as Record<string, unknown> | undefined
    const delta = streamEvent?.delta as Record<string, unknown> | undefined
    if (delta?.type === "text_delta" && delta.text) {
      if (outputState.needsBlankLineBeforeText) {
        process.stdout.write("\n")
        outputState.trailingNewlines = 2
        outputState.needsBlankLineBeforeText = false
      }
      writeWrappedText(delta.text as string)
      const match = (delta.text as string).match(/\n+$/)
      if (match) {
        outputState.trailingNewlines = Math.min(match[0].length, 2)
      } else {
        outputState.trailingNewlines = 0
      }
    }
  }

  // Show tool uses
  if (event.type === "assistant") {
    const message = event.message as Record<string, unknown> | undefined
    const content = message?.content as Array<Record<string, unknown>> | undefined
    if (content) {
      for (const block of content) {
        if (block.type === "tool_use") {
          const input = block.input as Record<string, unknown> | undefined
          if (block.name === "Read") {
            const filePath = input?.file_path as string | undefined
            if (filePath) {
              showToolUse("Read", rel(filePath))
            }
          } else if (block.name === "Edit" || block.name === "Write") {
            const filePath = input?.file_path as string | undefined
            if (filePath) {
              showToolUse(block.name as string, rel(filePath))
            }
          } else if (block.name === "Bash") {
            const command = input?.command as string | undefined
            if (command) {
              showToolUse("$", shortenTempPaths(command))
            }
          } else if (block.name === "Grep") {
            const pattern = input?.pattern as string | undefined
            const path = input?.path as string | undefined
            showToolUse("Grep", `${pattern}${path ? ` in ${rel(path)}` : ""}`)
          } else if (block.name === "Glob") {
            const pattern = input?.pattern as string | undefined
            const path = input?.path as string | undefined
            showToolUse("Glob", `${pattern}${path ? ` in ${rel(path)}` : ""}`)
          } else if (block.name === "TodoWrite") {
            const todos = input?.todos as Array<{ content: string; status: string }> | undefined
            if (todos?.length) {
              const todoIndent = toolIndent + "    "
              const summary = todos
                .map(
                  t =>
                    `[${
                      t.status === "completed" ? "x"
                      : t.status === "in_progress" ? "~"
                      : " "
                    }] ${t.content}`,
                )
                .join("\n" + todoIndent)
              showToolUse("TodoWrite", "\n" + todoIndent + summary)
            } else {
              showToolUse("TodoWrite")
            }
          } else if (block.name === "WebFetch") {
            const url = input?.url as string | undefined
            showToolUse("WebFetch", url)
          } else if (block.name === "WebSearch") {
            const query = input?.query as string | undefined
            showToolUse("WebSearch", query)
          } else if (block.name === "Task") {
            const description = input?.description as string | undefined
            showToolUse("Task", description)
          } else if (block.name === "Skill") {
            const skill = input?.skill as string | undefined
            showToolUse("Skill", skill)
          }
        }
      }
    }
  }
}

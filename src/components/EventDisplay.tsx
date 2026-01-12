import React, { useState, useEffect } from "react"
import { Box } from "ink"
import { StreamingText } from "./StreamingText.js"
import { ToolUse } from "./ToolUse.js"
import { rel } from "../lib/rel.js"
import { shortenTempPaths } from "../lib/shortenTempPaths.js"

export const EventDisplay = ({ events }: Props) => {
  const [textContent, setTextContent] = useState("")
  const [toolUses, setToolUses] = useState<Array<{ name: string; arg?: string }>>([])

  useEffect(() => {
    let currentText = ""
    const currentToolUses: Array<{ name: string; arg?: string }> = []

    for (const event of events) {
      // Stream text deltas
      if (event.type === "stream_event") {
        const streamEvent = event.event as Record<string, unknown> | undefined
        const delta = streamEvent?.delta as Record<string, unknown> | undefined
        if (delta?.type === "text_delta" && delta.text) {
          currentText += delta.text as string
        }
      }

      // Collect tool uses
      if (event.type === "assistant") {
        const message = event.message as Record<string, unknown> | undefined
        const content = message?.content as Array<Record<string, unknown>> | undefined
        if (content) {
          for (const block of content) {
            if (block.type === "tool_use") {
              const input = block.input as Record<string, unknown> | undefined
              const name = block.name as string

              if (name === "Read") {
                const filePath = input?.file_path as string | undefined
                if (filePath) {
                  currentToolUses.push({ name: "Read", arg: rel(filePath) })
                }
              } else if (name === "Edit" || name === "Write") {
                const filePath = input?.file_path as string | undefined
                if (filePath) {
                  currentToolUses.push({ name, arg: rel(filePath) })
                }
              } else if (name === "Bash") {
                const command = input?.command as string | undefined
                if (command) {
                  currentToolUses.push({ name: "$", arg: shortenTempPaths(command) })
                }
              } else if (name === "Grep") {
                const pattern = input?.pattern as string | undefined
                const path = input?.path as string | undefined
                currentToolUses.push({
                  name: "Grep",
                  arg: `${pattern}${path ? ` in ${rel(path)}` : ""}`,
                })
              } else if (name === "Glob") {
                const pattern = input?.pattern as string | undefined
                const path = input?.path as string | undefined
                currentToolUses.push({
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
                  currentToolUses.push({ name: "TodoWrite", arg: "\n    " + summary })
                } else {
                  currentToolUses.push({ name: "TodoWrite" })
                }
              } else if (name === "WebFetch") {
                const url = input?.url as string | undefined
                currentToolUses.push({ name: "WebFetch", arg: url })
              } else if (name === "WebSearch") {
                const query = input?.query as string | undefined
                currentToolUses.push({ name: "WebSearch", arg: query })
              } else if (name === "Task") {
                const description = input?.description as string | undefined
                currentToolUses.push({ name: "Task", arg: description })
              } else if (name === "Skill") {
                const skill = input?.skill as string | undefined
                currentToolUses.push({ name: "Skill", arg: skill })
              }
            }
          }
        }
      }
    }

    setTextContent(currentText)
    setToolUses(currentToolUses)
  }, [events])

  return (
    <Box flexDirection="column">
      {toolUses.map((tool, i) => (
        <ToolUse key={i} name={tool.name} arg={tool.arg} />
      ))}
      {textContent && <StreamingText content={textContent} />}
    </Box>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
}

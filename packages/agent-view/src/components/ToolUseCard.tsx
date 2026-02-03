import { useState } from "react"
import { cn } from "../lib/utils"
import { useAgentViewContext } from "../context/useAgentViewContext"
import { TextWithLinks } from "./TextWithLinks"
import { getLanguageFromFilePath } from "../lib/getLanguageFromFilePath"
import { getOutputSummary } from "../lib/getOutputSummary"
import { getPreviewInfo } from "../lib/getPreviewInfo"
import { getStatusColor } from "../lib/getStatusColor"
import { getToolSummary } from "../lib/getToolSummary"
import type { ToolUseEvent } from "../types"
import { AnsiOutput } from "./AnsiOutput"
import { DiffView } from "./DiffView"
import { TodoList } from "./TodoList"

/**
 * Render a tool use event with collapsible output, supporting multiple tool types.
 * Handles Edit diffs, Bash output with ANSI codes, todo updates, and generic tool results.
 */
export function ToolUseCard({
  /** The tool use event to display */
  event,
  /** Optional CSS class to apply to the root container */
  className,
  /** Whether the output preview should start expanded (default: true) */
  defaultExpanded = true,
}: ToolUseCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const { workspacePath, toolOutput } = useAgentViewContext()

  const summary = getToolSummary(event.tool, event.input, workspacePath)
  const outputSummary = getOutputSummary(event.tool, event.output)
  const statusColor = getStatusColor(event.status)

  const showToolOutput = toolOutput?.isVisible ?? true
  const toggleToolOutput = toolOutput?.onToggle

  const hasExpandableContent = Boolean(
    event.output ||
    event.error ||
    (event.tool === "Edit" && event.input?.old_string && event.input?.new_string),
  )

  if (event.tool === "TodoWrite" && event.input?.todos && Array.isArray(event.input.todos)) {
    return (
      <div className={cn("py-1.5 pr-12 pl-4", className)}>
        <div className="flex items-center gap-2.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", statusColor)} />
          <span className="text-foreground text-xs font-semibold">Update Todos</span>
        </div>
        <div className="border-muted-foreground/30 mt-1 ml-4 border-l pl-3">
          <TodoList
            todos={event.input.todos as Array<{ content: string; status: string }>}
            className="text-xs"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("py-1.5 pr-12 pl-4", className)}>
      <div
        className={cn("flex w-full items-center gap-2.5", hasExpandableContent && "cursor-pointer")}
        onClick={hasExpandableContent ? toggleToolOutput : undefined}
        role={hasExpandableContent ? "button" : undefined}
        aria-expanded={hasExpandableContent ? showToolOutput : undefined}
        aria-label={hasExpandableContent ? `Toggle ${event.tool} output` : undefined}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", statusColor)}
          aria-label={event.status ?? "pending"}
        />

        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-foreground shrink-0 text-xs font-semibold">{event.tool}</span>

          {summary && (
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-xs">
              <TextWithLinks>{summary}</TextWithLinks>
            </span>
          )}

          {hasExpandableContent && (
            <span className="text-muted-foreground/50 shrink-0 text-xs">
              {showToolOutput ? "▾" : "▸"}
            </span>
          )}
        </div>
      </div>

      {showToolOutput && hasExpandableContent && (
        <div className="border-muted-foreground/30 mt-1 ml-1 border-l pl-3">
          <div className="text-muted-foreground flex items-start gap-1 text-xs">
            <span>└</span>
            <div className="flex-1">
              {event.tool === "Edit" &&
                typeof event.input?.old_string === "string" &&
                typeof event.input?.new_string === "string" && (
                  <DiffView
                    oldString={event.input.old_string}
                    newString={event.input.new_string}
                    language={
                      typeof event.input?.file_path === "string" ?
                        getLanguageFromFilePath(event.input.file_path)
                      : "text"
                    }
                    isExpanded={isExpanded}
                    onExpand={() => setIsExpanded(true)}
                  />
                )}

              {outputSummary && <span>{outputSummary}</span>}

              {event.tool === "Bash" && event.output && (
                <AnsiOutput
                  code={event.output}
                  isExpanded={isExpanded}
                  onExpand={() => setIsExpanded(true)}
                />
              )}

              {event.output &&
                !outputSummary &&
                event.tool !== "Bash" &&
                event.tool !== "Edit" &&
                (() => {
                  const { preview, remainingLines } = getPreviewInfo(event.output)
                  return (
                    <pre
                      onClick={
                        !isExpanded && remainingLines > 0 ? () => setIsExpanded(true) : undefined
                      }
                      className={cn(
                        "bg-muted/30 text-foreground/80 mt-1 overflow-auto rounded border p-2 font-mono text-xs whitespace-pre-wrap",
                        !isExpanded && remainingLines > 0 && "cursor-pointer",
                      )}
                    >
                      <TextWithLinks>{isExpanded ? event.output : preview}</TextWithLinks>
                      {!isExpanded && remainingLines > 0 && (
                        <>
                          {"\n"}
                          <span className="text-muted-foreground">... +{remainingLines} lines</span>
                        </>
                      )}
                    </pre>
                  )
                })()}

              {event.error && (
                <div className="text-status-error my-1">{event.error.split("\n")[0]}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export type ToolUseCardProps = {
  event: ToolUseEvent
  className?: string
  defaultExpanded?: boolean
}

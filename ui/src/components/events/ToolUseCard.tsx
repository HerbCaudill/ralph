import { useState } from "react"
import { cn } from "@/lib/utils"
import { useAppStore, selectWorkspace } from "@/store"
import { TaskIdLink } from "@/components/ui/TaskIdLink"
import { getLanguageFromFilePath } from "@/lib/getLanguageFromFilePath"
import { getOutputSummary } from "@/lib/getOutputSummary"
import { getPreviewInfo } from "@/lib/getPreviewInfo"
import { getStatusColor } from "@/lib/getStatusColor"
import { getToolSummary } from "@/lib/getToolSummary"
import type { ToolUseEvent } from "@/types"
import { AnsiOutput } from "./AnsiOutput"
import { DiffView } from "./DiffView"
import { TodoList } from "./TodoList"

export function ToolUseCard({ event, className, defaultExpanded = false }: ToolUseCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const workspace = useAppStore(selectWorkspace)
  const showToolOutput = useAppStore(state => state.showToolOutput)

  const summary = getToolSummary(event.tool, event.input, workspace)
  const outputSummary = getOutputSummary(event.tool, event.output)
  const statusColor = getStatusColor(event.status)

  const hasExpandableContent = Boolean(
    event.output ||
      event.error ||
      (event.tool === "Edit" && event.input?.old_string && event.input?.new_string),
  )

  if (event.tool === "TodoWrite" && event.input?.todos && Array.isArray(event.input.todos)) {
    return (
      <div className={cn("py-1.5 pr-4 pl-4", className)}>
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
    <div className={cn("py-1.5 pr-4 pl-4", className)}>
      <div className="flex w-full items-center gap-2.5">
        <span
          className={cn("size-1.5 shrink-0 rounded-full", statusColor)}
          aria-label={event.status ?? "pending"}
        />

        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-foreground shrink-0 text-xs font-semibold">{event.tool}</span>

          {summary && (
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-xs">
              <TaskIdLink>{summary}</TaskIdLink>
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
                      <TaskIdLink>{isExpanded ? event.output : preview}</TaskIdLink>
                      {!isExpanded && remainingLines > 0 && (
                        <>
                          {"\n"}
                          <span className="text-muted-foreground">
                            ... +{remainingLines} lines
                          </span>
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

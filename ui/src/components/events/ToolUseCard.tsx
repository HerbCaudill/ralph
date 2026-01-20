import { cn, toRelativePath } from "@/lib/utils"
import { useState } from "react"
import { useAppStore, selectWorkspace } from "@/store"
import { TaskIdLink } from "@/components/ui/TaskIdLink"

// Types

export type ToolName =
  | "Read"
  | "Edit"
  | "Write"
  | "Bash"
  | "Grep"
  | "Glob"
  | "WebSearch"
  | "WebFetch"
  | "TodoWrite"
  | "Task"

export interface ToolUseEvent {
  type: "tool_use"
  timestamp: number
  tool: ToolName
  input?: Record<string, unknown>
  output?: string
  status?: "pending" | "running" | "success" | "error"
  duration?: number
  error?: string
}

// Helper Functions

function getStatusColor(status?: string): string {
  switch (status) {
    case "running":
      return "bg-status-info"
    case "success":
      return "bg-status-success"
    case "error":
      return "bg-status-error"
    case "pending":
    default:
      return "bg-status-warning"
  }
}

function getToolSummary(
  tool: ToolName,
  input?: Record<string, unknown>,
  workspace?: string | null,
): string {
  if (!input) return ""

  switch (tool) {
    case "Read":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "Edit":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "Write":
      return input.file_path ? toRelativePath(String(input.file_path), workspace ?? null) : ""
    case "Bash":
      return input.command ? String(input.command) : ""
    case "Grep":
      return input.pattern ? String(input.pattern) : ""
    case "Glob":
      return input.pattern ? String(input.pattern) : ""
    case "WebSearch":
      return input.query ? String(input.query) : ""
    case "WebFetch":
      return input.url ? String(input.url) : ""
    case "TodoWrite":
      if (Array.isArray(input.todos)) {
        return `${input.todos.length} todo(s)`
      }
      return ""
    case "Task":
      return input.description ? String(input.description) : ""
    default:
      return ""
  }
}

function getOutputSummary(tool: ToolName, output?: string): string | null {
  if (!output) return null

  if (tool === "Read") {
    const lines = output.split("\n").length
    return `Read ${lines} line${lines !== 1 ? "s" : ""}`
  }

  return null
}

function parseDiff(oldString: string, newString: string): DiffLine[] {
  const oldLines = oldString.split("\n")
  const newLines = newString.split("\n")
  const result: DiffLine[] = []

  // Find context around the change
  let oldIdx = 0
  let newIdx = 0

  // Simple diff: show removed lines then added lines
  // For a more sophisticated diff, we'd use a proper diff algorithm

  // Find common prefix
  while (
    oldIdx < oldLines.length &&
    newIdx < newLines.length &&
    oldLines[oldIdx] === newLines[newIdx]
  ) {
    oldIdx++
    newIdx++
  }

  // Show some context before
  const contextStart = Math.max(0, oldIdx - 1)
  for (let i = contextStart; i < oldIdx; i++) {
    result.push({ type: "context", lineOld: i + 1, lineNew: i + 1, content: oldLines[i] })
  }

  // Find common suffix
  let oldEnd = oldLines.length - 1
  let newEnd = newLines.length - 1
  while (oldEnd > oldIdx && newEnd > newIdx && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--
    newEnd--
  }

  // Show removed lines
  for (let i = oldIdx; i <= oldEnd; i++) {
    result.push({ type: "removed", lineOld: i + 1, content: oldLines[i] })
  }

  // Show added lines
  for (let i = newIdx; i <= newEnd; i++) {
    result.push({ type: "added", lineNew: i + 1, content: newLines[i] })
  }

  // Show some context after
  const contextEnd = Math.min(oldLines.length - 1, oldEnd + 2)
  for (let i = oldEnd + 1; i <= contextEnd; i++) {
    const newLineNum = i - oldEnd + newEnd
    if (i < oldLines.length && newLineNum < newLines.length) {
      result.push({
        type: "context",
        lineOld: i + 1,
        lineNew: newLineNum + 1,
        content: oldLines[i],
      })
    }
  }

  return result
}

interface DiffLine {
  type: "context" | "added" | "removed"
  lineOld?: number
  lineNew?: number
  content: string
}

function DiffView({
  oldString,
  newString,
  isExpanded,
  onExpand,
}: {
  oldString: string
  newString: string
  isExpanded: boolean
  onExpand?: () => void
}) {
  const lines = parseDiff(oldString, newString)
  const shouldTruncate = !isExpanded && lines.length > PREVIEW_LINES
  const displayLines = shouldTruncate ? lines.slice(0, PREVIEW_LINES) : lines
  const remainingLines = lines.length - PREVIEW_LINES

  return (
    <div
      className={cn(
        "bg-muted/30 overflow-x-auto rounded border font-mono text-xs",
        shouldTruncate && "cursor-pointer",
      )}
      onClick={shouldTruncate ? onExpand : undefined}
    >
      {displayLines.map((line, i) => (
        <div
          key={i}
          className={cn(
            "flex",
            line.type === "added" && "bg-status-success/20",
            line.type === "removed" && "bg-status-error/20",
          )}
        >
          <span className="text-muted-foreground w-8 shrink-0 border-r px-1 text-right select-none">
            {line.lineOld ?? ""}
          </span>
          <span className="text-muted-foreground w-8 shrink-0 border-r px-1 text-right select-none">
            {line.lineNew ?? ""}
          </span>
          <span className="w-4 shrink-0 text-center select-none">
            {line.type === "added" ?
              <span className="text-status-success">+</span>
            : line.type === "removed" ?
              <span className="text-status-error">-</span>
            : ""}
          </span>
          <span className="flex-1 px-2 whitespace-pre">{line.content}</span>
        </div>
      ))}
      {shouldTruncate && (
        <div className="text-muted-foreground border-t px-2 py-1">... +{remainingLines} lines</div>
      )}
    </div>
  )
}

function TodoList({
  todos,
  className,
}: {
  todos: Array<{ content: string; status: string }>
  className?: string
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {todos.map((todo, i) => (
        <div key={i} className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex size-3 shrink-0 items-center justify-center rounded-xs border text-[10px]",
              todo.status === "completed" &&
                "border-status-success bg-status-success/20 text-status-success",
              todo.status === "in_progress" &&
                "border-status-info bg-status-info/20 text-status-info",
              todo.status === "pending" && "border-muted-foreground",
            )}
          >
            {todo.status === "completed" && "✓"}
            {todo.status === "in_progress" && "•"}
          </span>
          <span
            className={cn(
              todo.status === "completed" && "text-muted-foreground line-through",
              todo.status === "in_progress" && "text-foreground",
              todo.status === "pending" && "text-muted-foreground",
            )}
          >
            {todo.content}
          </span>
        </div>
      ))}
    </div>
  )
}

// Helper to get preview lines and remaining count
const PREVIEW_LINES = 5

function getPreviewInfo(content: string): { preview: string; remainingLines: number } {
  const lines = content.split("\n")
  if (lines.length <= PREVIEW_LINES) {
    return { preview: content, remainingLines: 0 }
  }
  return {
    preview: lines.slice(0, PREVIEW_LINES).join("\n"),
    remainingLines: lines.length - PREVIEW_LINES,
  }
}

// ToolUseCard Component

export function ToolUseCard({ event, className, defaultExpanded = false }: ToolUseCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const workspace = useAppStore(selectWorkspace)

  const summary = getToolSummary(event.tool, event.input, workspace)
  const outputSummary = getOutputSummary(event.tool, event.output)
  const statusColor = getStatusColor(event.status)

  const hasExpandableContent = Boolean(
    event.output ||
    event.error ||
    (event.tool === "Edit" && event.input?.old_string && event.input?.new_string),
  )

  // Special handling for TodoWrite
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

  // Calculate preview info for bash output
  const bashPreviewInfo =
    event.tool === "Bash" && event.output ? getPreviewInfo(event.output) : null

  return (
    <div className={cn("py-1.5 pr-4 pl-4", className)}>
      {/* Main row */}
      <div className="flex w-full items-center gap-2.5">
        {/* Status indicator */}
        <span
          className={cn("size-1.5 shrink-0 rounded-full", statusColor)}
          aria-label={event.status ?? "pending"}
        />

        {/* Content */}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {/* Tool name */}
          <span className="text-foreground shrink-0 text-xs font-semibold">{event.tool}</span>

          {/* Summary (file path, command, etc.) */}
          {summary && (
            <span className="text-foreground/80 min-w-0 flex-1 truncate font-mono text-xs">
              <TaskIdLink>{summary}</TaskIdLink>
            </span>
          )}
        </div>
      </div>

      {/* Output content */}
      {hasExpandableContent && (
        <div className="border-muted-foreground/30 mt-1 ml-1 border-l pl-3">
          <div className="text-muted-foreground flex items-start gap-1 text-xs">
            <span>└</span>
            <div className="flex-1">
              {/* Edit tool: show diff */}
              {event.tool === "Edit" &&
                typeof event.input?.old_string === "string" &&
                typeof event.input?.new_string === "string" && (
                  <DiffView
                    oldString={event.input.old_string}
                    newString={event.input.new_string}
                    isExpanded={isExpanded}
                    onExpand={() => setIsExpanded(true)}
                  />
                )}

              {/* Output summary for Read */}
              {outputSummary && <span>{outputSummary}</span>}

              {/* Bash output */}
              {bashPreviewInfo && (
                <pre
                  onClick={
                    !isExpanded && bashPreviewInfo.remainingLines > 0 ?
                      () => setIsExpanded(true)
                    : undefined
                  }
                  className={cn(
                    "bg-muted/30 text-foreground/80 mt-1 overflow-auto rounded border p-2 font-mono text-xs whitespace-pre-wrap",
                    !isExpanded && bashPreviewInfo.remainingLines > 0 && "cursor-pointer",
                  )}
                >
                  <TaskIdLink>
                    {isExpanded ? (event.output ?? "") : bashPreviewInfo.preview}
                  </TaskIdLink>
                  {!isExpanded && bashPreviewInfo.remainingLines > 0 && (
                    <>
                      {"\n"}
                      <span className="text-muted-foreground">
                        ... +{bashPreviewInfo.remainingLines} lines
                      </span>
                    </>
                  )}
                </pre>
              )}

              {/* Generic output for Glob, Grep, WebSearch, WebFetch, etc. */}
              {event.output &&
                !outputSummary &&
                !bashPreviewInfo &&
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
                          <span className="text-muted-foreground">... +{remainingLines} lines</span>
                        </>
                      )}
                    </pre>
                  )
                })()}

              {/* Error - show first line only */}
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

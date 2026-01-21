import { cn } from "@/lib/utils"

export function TodoList({ todos, className }: Props) {
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

type Props = {
  todos: Array<{ content: string; status: string }>
  className?: string
}

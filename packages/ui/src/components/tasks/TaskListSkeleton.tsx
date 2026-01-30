import { cn } from "@/lib/utils"

/**
 * Loading skeleton for the TaskList component.
 * Displays placeholder UI that mimics the task list structure while data is loading.
 */
export function TaskListSkeleton({ className }: TaskListSkeletonProps) {
  return (
    <div
      className={cn("h-full overflow-y-auto", className)}
      role="status"
      aria-label="Loading tasks"
    >
      {/* Open group skeleton */}
      <TaskGroupHeaderSkeleton />
      <TaskCardSkeleton />
      <TaskCardSkeleton width="85%" />
      <TaskCardSkeleton width="70%" />
      <TaskCardSkeleton />
      <TaskCardSkeleton width="75%" />

      {/* Closed group skeleton */}
      <TaskGroupHeaderSkeleton />
    </div>
  )
}

/**  Skeleton for a task group header. */
function TaskGroupHeaderSkeleton() {
  return (
    <div className="bg-muted/50 border-border flex items-center gap-2 border-b px-2 py-1.5">
      {/* Chevron placeholder */}
      <div className="bg-muted-foreground/20 size-3.5 animate-pulse rounded" />
      {/* Label placeholder */}
      <div className="bg-muted-foreground/20 h-3 w-10 animate-pulse rounded" />
      {/* Count placeholder */}
      <div className="bg-muted-foreground/20 h-4 w-6 animate-pulse rounded" />
    </div>
  )
}

/**  Skeleton for an individual task card. */
function TaskCardSkeleton({ width = "90%" }: { width?: string }) {
  return (
    <div className="border-border flex items-center gap-2 border-b px-2 py-1.5">
      {/* Chevron column placeholder */}
      <div className="w-4 shrink-0" />

      {/* Status icon placeholder */}
      <div className="bg-muted-foreground/20 size-3.5 shrink-0 animate-pulse rounded-full" />

      {/* Task ID placeholder */}
      <div className="bg-muted-foreground/20 h-3 w-12 shrink-0 animate-pulse rounded" />

      {/* Title placeholder */}
      <div
        className="bg-muted-foreground/20 h-3 min-w-0 flex-1 animate-pulse rounded"
        style={{ maxWidth: width }}
      />
    </div>
  )
}

/**  Props for the TaskListSkeleton component. */
export type TaskListSkeletonProps = {
  /** Additional CSS classes to apply */
  className?: string
}

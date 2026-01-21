import { useAppStore, selectIteration } from "@/store"

export function IterationProgress({}: Props) {
  const iteration = useAppStore(selectIteration)

  if (iteration.total === 0) return null

  const progress = (iteration.current / iteration.total) * 100

  return (
    <div className="flex items-center gap-2" title={`Iteration ${iteration.current} of ${iteration.total}`}>
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs">
        {iteration.current}/{iteration.total}
      </span>
    </div>
  )
}

type Props = {}

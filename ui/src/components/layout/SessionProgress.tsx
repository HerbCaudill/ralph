import { useAppStore, selectSession } from "@/store"

export function SessionProgress({}: Props) {
  const session = useAppStore(selectSession)

  if (session.total === 0) return null

  const progress = (session.current / session.total) * 100

  return (
    <div
      className="flex items-center gap-2"
      title={`Session ${session.current} of ${session.total}`}
    >
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <div
          className="bg-repo-accent h-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs">
        {session.current}/{session.total}
      </span>
    </div>
  )
}

type Props = {}

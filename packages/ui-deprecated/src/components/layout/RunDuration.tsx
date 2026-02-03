import { useEffect, useState } from "react"
import { IconClock } from "@tabler/icons-react"
import { formatElapsedTime } from "@/lib/formatElapsedTime"
import { useAppStore, selectRunStartedAt } from "@/store"

export function RunDuration({}: Props) {
  const runStartedAt = useAppStore(selectRunStartedAt)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!runStartedAt) {
      setElapsed(0)
      return
    }

    setElapsed(Date.now() - runStartedAt)

    const interval = setInterval(() => {
      setElapsed(Date.now() - runStartedAt)
    }, 1000)

    return () => clearInterval(interval)
  }, [runStartedAt])

  if (!runStartedAt) return null

  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs" title="Time running">
      <IconClock className="size-3 shrink-0" />
      <span>{formatElapsedTime(elapsed)}</span>
    </div>
  )
}

type Props = {}

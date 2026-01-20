import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  IconTopologyStar,
  IconTopologyStar2,
  IconTopologyStar3,
  IconTopologyStarRing,
  IconTopologyStarRing2,
  IconTopologyStarRing3,
} from "@tabler/icons-react"

const TOPOLOGY_ICONS = [
  IconTopologyStar,
  IconTopologyStar2,
  IconTopologyStar3,
  IconTopologyStarRing,
  IconTopologyStarRing2,
  IconTopologyStarRing3,
]

export interface TopologySpinnerProps {
  className?: string
  /** Interval between icon changes in milliseconds @default 300 */
  interval?: number
}

/**
 * Animated spinner that cycles through 6 topology icons while spinning.
 */
export function TopologySpinner({ className, interval = 300 }: TopologySpinnerProps) {
  const [iconIndex, setIconIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIconIndex(prev => (prev + 1) % TOPOLOGY_ICONS.length)
    }, interval)
    return () => clearInterval(timer)
  }, [interval])

  const Icon = TOPOLOGY_ICONS[iconIndex]

  return (
    <Icon
      className={cn("text-muted-foreground size-4 animate-spin", className)}
      aria-hidden="true"
    />
  )
}

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  IconTopologyFull,
  IconTopologyFullHierarchy,
  IconTopologyRing,
  IconTopologyRing2,
  IconTopologyRing3,
  IconTopologyStar2,
  IconTopologyStarRing,
  IconTopologyStar3,
  IconTopologyStarRing3,
} from "@tabler/icons-react"

const TOPOLOGY_ICONS = [
  IconTopologyFull,
  IconTopologyFullHierarchy,
  IconTopologyRing,
  IconTopologyRing2,
  IconTopologyRing3,
  IconTopologyStar2,
  IconTopologyStar3,
  IconTopologyStarRing,
  IconTopologyStarRing3,
]

/**  Animated spinner that shows random topology icons while spinning and pulsating. */
export function TopologySpinner({ className, duration = 1000 }: TopologySpinnerProps) {
  const [iconIndex, setIconIndex] = useState(() =>
    Math.floor(Math.random() * TOPOLOGY_ICONS.length),
  )

  /** Pick a random different icon when the spin animation completes a cycle. */
  const handleAnimationIteration = useCallback(() => {
    setIconIndex(prev => {
      let next: number
      do {
        next = Math.floor(Math.random() * TOPOLOGY_ICONS.length)
      } while (next === prev && TOPOLOGY_ICONS.length > 1)
      return next
    })
  }, [])

  const Icon = TOPOLOGY_ICONS[iconIndex]

  return (
    <Icon
      className={cn("text-repo-accent animate-spin-pulse size-6", className)}
      style={{ animationDuration: `${duration}ms` }}
      onAnimationIteration={handleAnimationIteration}
      aria-hidden="true"
    />
  )
}

export interface TopologySpinnerProps {
  className?: string
  /** Duration of one full rotation in milliseconds. @default 1000 */
  duration?: number
}

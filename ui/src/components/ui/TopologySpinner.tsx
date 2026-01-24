import { useState, useCallback } from "react"
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

/**  Animated spinner that cycles through 6 topology icons while spinning. */
export function TopologySpinner({ className }: TopologySpinnerProps) {
  const [iconIndex, setIconIndex] = useState(0)

  /** Advance to the next icon when the spin animation completes a cycle. */
  const handleAnimationIteration = useCallback(() => {
    setIconIndex(prev => (prev + 1) % TOPOLOGY_ICONS.length)
  }, [])

  const Icon = TOPOLOGY_ICONS[iconIndex]

  return (
    <Icon
      className={cn("text-repo-accent size-4 animate-spin", className)}
      onAnimationIteration={handleAnimationIteration}
      aria-hidden="true"
    />
  )
}

export interface TopologySpinnerProps {
  className?: string
}

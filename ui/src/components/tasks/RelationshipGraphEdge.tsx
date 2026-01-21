import { cn } from "@/lib/utils"

export function RelationshipGraphEdge({ from, to, type }: Props) {
  const isVertical = Math.abs(from.x - to.x) < Math.abs(from.y - to.y)

  let path: string
  if (isVertical) {
    path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  } else {
    const controlOffset = Math.abs(to.x - from.x) * 0.3
    path = `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`
  }

  return (
    <path
      d={path}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeDasharray={type === "blocks" ? "4 2" : "none"}
      className={cn(
        type === "parent-child" ? "text-muted-foreground" : "text-amber-500 dark:text-amber-400",
      )}
      markerEnd="url(#arrowhead)"
    />
  )
}

type Props = {
  from: { x: number; y: number }
  to: { x: number; y: number }
  type: "parent-child" | "blocks"
  direction?: "up" | "down" | "left" | "right"
}

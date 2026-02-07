import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ButtonGroup } from "../components/button-group"
import { cn } from "../lib/cn"

const meta = {
  title: "Patterns/Priority",
  parameters: {
    layout: "padded",
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const priorityOptions = [
  {
    value: 0,
    short: "P0",
    color: "text-red-600",
    selectedBg: "bg-red-600",
    unselectedHover: "hover:bg-red-600/20",
  },
  {
    value: 1,
    short: "P1",
    color: "text-orange-500",
    selectedBg: "bg-orange-500",
    unselectedHover: "hover:bg-orange-500/20",
  },
  {
    value: 2,
    short: "P2",
    color: "text-amber-500",
    selectedBg: "bg-amber-500",
    unselectedHover: "hover:bg-amber-500/20",
  },
  {
    value: 3,
    short: "P3",
    color: "text-yellow-500",
    selectedBg: "bg-yellow-500",
    unselectedHover: "hover:bg-yellow-500/20",
  },
  {
    value: 4,
    short: "P4",
    color: "text-gray-500",
    selectedBg: "bg-gray-500",
    unselectedHover: "hover:bg-gray-500/20",
  },
]

/** Interactive priority selector using ButtonGroup. */
function PrioritySelector() {
  const [selected, setSelected] = useState(2)
  return (
    <ButtonGroup className="bg-background h-8 overflow-hidden">
      {priorityOptions.map(p => {
        const isSelected = selected === p.value
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => setSelected(p.value)}
            className={cn(
              "flex h-full items-center justify-center gap-1 px-2 transition-colors",
              isSelected
                ? cn("text-white", p.selectedBg)
                : cn(p.color, "bg-transparent", p.unselectedHover),
            )}
            aria-pressed={isSelected}
          >
            <span>{p.short}</span>
          </button>
        )
      })}
    </ButtonGroup>
  )
}

export const Default: Story = {
  render: () => <PrioritySelector />,
}

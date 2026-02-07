import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  IconCircle,
  IconCircleDot,
  IconBan,
  IconClock,
  IconCircleCheck,
} from "@tabler/icons-react"
import { ResponsiveButtonGroup } from "../components/responsive-button-group"
import { cn } from "../lib/cn"

const meta = {
  title: "Patterns/Status",
  parameters: {
    layout: "padded",
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const statusOptions = [
  {
    value: "open",
    label: "Open",
    icon: IconCircle,
    color: "text-status-success",
    selectedBg: "bg-status-success",
    unselectedHover: "hover:bg-status-success/20",
  },
  {
    value: "in_progress",
    label: "In progress",
    icon: IconCircleDot,
    color: "text-status-info",
    selectedBg: "bg-status-info",
    unselectedHover: "hover:bg-status-info/20",
  },
  {
    value: "blocked",
    label: "Blocked",
    icon: IconBan,
    color: "text-status-error",
    selectedBg: "bg-status-error",
    unselectedHover: "hover:bg-status-error/20",
  },
  {
    value: "deferred",
    label: "Deferred",
    icon: IconClock,
    color: "text-status-warning",
    selectedBg: "bg-status-warning",
    unselectedHover: "hover:bg-status-warning/20",
  },
  {
    value: "closed",
    label: "Closed",
    icon: IconCircleCheck,
    color: "text-status-neutral",
    selectedBg: "bg-status-neutral",
    unselectedHover: "hover:bg-status-neutral/20",
  },
]

/** Interactive status selector using ResponsiveButtonGroup. */
function StatusSelector() {
  const [selected, setSelected] = useState("open")
  return (
    <div style={{ width: 400 }}>
      <ResponsiveButtonGroup>
        {statusOptions.map(s => {
          const Icon = s.icon
          const isSelected = selected === s.value
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setSelected(s.value)}
              className={cn(
                "flex h-full items-center justify-center gap-1 px-2 transition-colors",
                isSelected
                  ? cn("text-white", s.selectedBg)
                  : cn(s.color, "bg-transparent", s.unselectedHover),
              )}
              aria-pressed={isSelected}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span data-label>{s.label}</span>
            </button>
          )
        })}
      </ResponsiveButtonGroup>
    </div>
  )
}

export const Default: Story = {
  render: () => <StatusSelector />,
}

/** Narrow width collapses to icon-only mode. */
function StatusSelectorNarrow() {
  const [selected, setSelected] = useState("in_progress")
  return (
    <div style={{ width: 180 }}>
      <ResponsiveButtonGroup>
        {statusOptions.map(s => {
          const Icon = s.icon
          const isSelected = selected === s.value
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setSelected(s.value)}
              className={cn(
                "flex h-full items-center justify-center gap-1 px-2 transition-colors",
                isSelected
                  ? cn("text-white", s.selectedBg)
                  : cn(s.color, "bg-transparent", s.unselectedHover),
              )}
              aria-pressed={isSelected}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span data-label>{s.label}</span>
            </button>
          )
        })}
      </ResponsiveButtonGroup>
    </div>
  )
}

export const Narrow: Story = {
  render: () => <StatusSelectorNarrow />,
}

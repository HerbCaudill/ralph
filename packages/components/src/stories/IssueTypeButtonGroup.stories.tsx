import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCheckbox, IconBug, IconStack2 } from "@tabler/icons-react"
import { ResponsiveButtonGroup } from "../components/responsive-button-group"
import { cn } from "../lib/cn"

const meta = {
  title: "Patterns/Issue type",
  parameters: {
    layout: "padded",
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const issueTypeOptions = [
  {
    value: "task",
    label: "Task",
    icon: IconCheckbox,
    color: "text-status-success",
    selectedBg: "bg-status-success",
    unselectedHover: "hover:bg-status-success/20",
  },
  {
    value: "bug",
    label: "Bug",
    icon: IconBug,
    color: "text-status-error",
    selectedBg: "bg-status-error",
    unselectedHover: "hover:bg-status-error/20",
  },
  {
    value: "epic",
    label: "Epic",
    icon: IconStack2,
    color: "text-status-info",
    selectedBg: "bg-status-info",
    unselectedHover: "hover:bg-status-info/20",
  },
]

/** Interactive issue type selector using ResponsiveButtonGroup. */
function IssueTypeSelector() {
  const [selected, setSelected] = useState("task")
  return (
    <div style={{ width: 300 }}>
      <ResponsiveButtonGroup>
        {issueTypeOptions.map(t => {
          const Icon = t.icon
          const isSelected = selected === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setSelected(t.value)}
              className={cn(
                "flex h-full items-center justify-center gap-1 px-2 transition-colors",
                isSelected
                  ? cn("text-white", t.selectedBg)
                  : cn(t.color, "bg-transparent", t.unselectedHover),
              )}
              aria-pressed={isSelected}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span data-label>{t.label}</span>
            </button>
          )
        })}
      </ResponsiveButtonGroup>
    </div>
  )
}

export const Default: Story = {
  render: () => <IssueTypeSelector />,
}

/** Narrow width collapses to icon-only mode. */
function IssueTypeSelectorNarrow() {
  const [selected, setSelected] = useState("bug")
  return (
    <div style={{ width: 120 }}>
      <ResponsiveButtonGroup>
        {issueTypeOptions.map(t => {
          const Icon = t.icon
          const isSelected = selected === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setSelected(t.value)}
              className={cn(
                "flex h-full items-center justify-center gap-1 px-2 transition-colors",
                isSelected
                  ? cn("text-white", t.selectedBg)
                  : cn(t.color, "bg-transparent", t.unselectedHover),
              )}
              aria-pressed={isSelected}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span data-label>{t.label}</span>
            </button>
          )
        })}
      </ResponsiveButtonGroup>
    </div>
  )
}

export const Narrow: Story = {
  render: () => <IssueTypeSelectorNarrow />,
}

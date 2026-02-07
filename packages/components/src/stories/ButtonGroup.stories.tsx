import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconCircle,
  IconCircleDot,
  IconBan,
  IconClock,
  IconCircleCheck,
  IconCheckbox,
  IconBug,
  IconStack2,
} from "@tabler/icons-react"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "../components/button-group"
import { ResponsiveButtonGroup } from "../components/responsive-button-group"
import { Button } from "../components/button"
import { cn } from "../lib/cn"

const meta = {
  title: "ButtonGroup",
  component: ButtonGroup,
} satisfies Meta<typeof ButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="sm">
        <IconBold />
      </Button>
      <Button variant="outline" size="sm">
        <IconItalic />
      </Button>
      <Button variant="outline" size="sm">
        <IconUnderline />
      </Button>
    </ButtonGroup>
  ),
}

export const WithText: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="sm">
        Copy
      </Button>
      <Button variant="outline" size="sm">
        Cut
      </Button>
      <Button variant="outline" size="sm">
        Paste
      </Button>
    </ButtonGroup>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline" size="sm">
        <IconAlignLeft /> Left
      </Button>
      <Button variant="outline" size="sm">
        <IconAlignCenter /> Center
      </Button>
      <Button variant="outline" size="sm">
        <IconAlignRight /> Right
      </Button>
    </ButtonGroup>
  ),
}

export const WithSeparator: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="sm">
        <IconBold />
      </Button>
      <Button variant="outline" size="sm">
        <IconItalic />
      </Button>
      <ButtonGroupSeparator />
      <Button variant="outline" size="sm">
        <IconAlignLeft />
      </Button>
      <Button variant="outline" size="sm">
        <IconAlignCenter />
      </Button>
      <Button variant="outline" size="sm">
        <IconAlignRight />
      </Button>
    </ButtonGroup>
  ),
}

export const WithGroupText: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>Format</ButtonGroupText>
      <Button variant="outline" size="sm">
        <IconBold />
      </Button>
      <Button variant="outline" size="sm">
        <IconItalic />
      </Button>
      <Button variant="outline" size="sm">
        <IconUnderline />
      </Button>
    </ButtonGroup>
  ),
}

// ---- Color-coded toggle patterns ----

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

/** Color-coded toggle button helper. */
function ToggleButton({
  isSelected,
  color,
  selectedBg,
  unselectedHover,
  onClick,
  children,
}: {
  isSelected: boolean
  color: string
  selectedBg: string
  unselectedHover: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-full items-center justify-center gap-1 px-2 transition-colors",
        isSelected ? cn("text-white", selectedBg) : cn(color, "bg-transparent", unselectedHover),
      )}
      aria-pressed={isSelected}
    >
      {children}
    </button>
  )
}

export const Status: Story = {
  render: () => {
    const [selected, setSelected] = useState("open")
    return (
      <div style={{ width: 400 }}>
        <ResponsiveButtonGroup>
          {statusOptions.map(s => {
            const Icon = s.icon
            return (
              <ToggleButton
                key={s.value}
                isSelected={selected === s.value}
                onClick={() => setSelected(s.value)}
                {...s}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span data-label>{s.label}</span>
              </ToggleButton>
            )
          })}
        </ResponsiveButtonGroup>
      </div>
    )
  },
}

export const Priority: Story = {
  render: () => {
    const [selected, setSelected] = useState(2)
    return (
      <ButtonGroup className="bg-background h-8 overflow-hidden">
        {priorityOptions.map(p => (
          <ToggleButton
            key={p.value}
            isSelected={selected === p.value}
            onClick={() => setSelected(p.value)}
            {...p}
          >
            <span>{p.short}</span>
          </ToggleButton>
        ))}
      </ButtonGroup>
    )
  },
}

export const IssueType: Story = {
  render: () => {
    const [selected, setSelected] = useState("task")
    return (
      <div style={{ width: 300 }}>
        <ResponsiveButtonGroup>
          {issueTypeOptions.map(t => {
            const Icon = t.icon
            return (
              <ToggleButton
                key={t.value}
                isSelected={selected === t.value}
                onClick={() => setSelected(t.value)}
                {...t}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span data-label>{t.label}</span>
              </ToggleButton>
            )
          })}
        </ResponsiveButtonGroup>
      </div>
    )
  },
}

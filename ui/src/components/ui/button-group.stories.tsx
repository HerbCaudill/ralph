import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ButtonGroup, ButtonGroupSeparator } from "./button-group"
import { Button } from "./button"
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
  IconPlayerStop,
  IconBold,
  IconItalic,
  IconUnderline,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  IconCheckbox,
  IconBug,
  IconStack2,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const meta: Meta<typeof ButtonGroup> = {
  title: "Primitives/ButtonGroup",
  component: ButtonGroup,
  parameters: {},
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">One</Button>
      <Button variant="outline">Two</Button>
      <Button variant="outline">Three</Button>
    </ButtonGroup>
  ),
}

export const WithIcons: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="icon">
        <IconBold />
      </Button>
      <Button variant="outline" size="icon">
        <IconItalic />
      </Button>
      <Button variant="outline" size="icon">
        <IconUnderline />
      </Button>
    </ButtonGroup>
  ),
}

export const MediaControls: Story = {
  render: () => (
    <ButtonGroup className="border-input overflow-hidden rounded-md border">
      <Button variant="ghost" size="icon-sm">
        <IconPlayerPlayFilled className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconPlayerPauseFilled className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconPlayerStopFilled className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconPlayerStop className="size-4" />
      </Button>
    </ButtonGroup>
  ),
}

export const WithSeparator: Story = {
  render: () => (
    <ButtonGroup className="border-input overflow-hidden rounded-md border">
      <Button variant="ghost" size="icon-sm">
        <IconAlignLeft className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconAlignCenter className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconAlignRight className="size-4" />
      </Button>
      <ButtonGroupSeparator />
      <Button variant="ghost" size="icon-sm">
        <IconBold className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconItalic className="size-4" />
      </Button>
    </ButtonGroup>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">Top</Button>
      <Button variant="outline">Middle</Button>
      <Button variant="outline">Bottom</Button>
    </ButtonGroup>
  ),
}

export const Mixed: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Cancel</Button>
      <Button variant="default">Save</Button>
    </ButtonGroup>
  ),
}

export const Bordered: Story = {
  render: () => (
    <ButtonGroup className="border-input h-8 overflow-hidden rounded-md border">
      <button className="flex h-full items-center justify-center px-3 text-sm transition-colors hover:bg-gray-100">
        One
      </button>
      <button className="flex h-full items-center justify-center bg-blue-500 px-3 text-sm text-white transition-colors">
        Two
      </button>
      <button className="flex h-full items-center justify-center px-3 text-sm transition-colors hover:bg-gray-100">
        Three
      </button>
    </ButtonGroup>
  ),
}

export const BorderedWithIcons: Story = {
  render: () => (
    <ButtonGroup className="border-input h-8 overflow-hidden rounded-md border">
      <button className="flex h-full items-center justify-center gap-1 px-2 text-sm transition-colors hover:bg-gray-100">
        <IconAlignLeft className="size-4" />
        <span>Left</span>
      </button>
      <button className="flex h-full items-center justify-center gap-1 bg-blue-500 px-2 text-sm text-white transition-colors">
        <IconAlignCenter className="size-4" />
        <span>Center</span>
      </button>
      <button className="flex h-full items-center justify-center gap-1 px-2 text-sm transition-colors hover:bg-gray-100">
        <IconAlignRight className="size-4" />
        <span>Right</span>
      </button>
    </ButtonGroup>
  ),
}

/** Status button group as used in TaskDetailsDialog */
export const StatusSelector: Story = {
  render: function StatusSelectorStory() {
    const [status, setStatus] = useState<TaskStatus>("open")
    return (
      <ButtonGroup className="border-input bg-background h-8 overflow-hidden rounded-md border">
        {statusOptions.map(s => {
          const config = statusConfig[s]
          const Icon = config.icon
          const isSelected = status === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "flex h-full items-center justify-center gap-1 px-2 text-xs transition-colors",
                isSelected ?
                  cn("text-white", config.selectedBg)
                : cn(config.color, config.unselectedBg, config.unselectedHover),
              )}
              aria-pressed={isSelected}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{config.label}</span>
            </button>
          )
        })}
      </ButtonGroup>
    )
  },
}

/** Priority button group as used in TaskDetailsDialog */
export const PrioritySelector: Story = {
  render: function PrioritySelectorStory() {
    const [priority, setPriority] = useState(2)
    return (
      <ButtonGroup className="border-input bg-background h-8 overflow-hidden rounded-md border">
        {priorityOptions.map(p => {
          const isSelected = priority === p.value
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={cn(
                "flex h-full items-center justify-center gap-1 px-2 text-xs transition-colors",
                isSelected ?
                  cn("text-white", p.selectedBg)
                : cn(p.color, p.unselectedBg, p.unselectedHover),
              )}
              aria-pressed={isSelected}
            >
              <span>{p.short}</span>
            </button>
          )
        })}
      </ButtonGroup>
    )
  },
}

/** Type button group as used in TaskDetailsDialog */
export const TypeSelector: Story = {
  render: function TypeSelectorStory() {
    const [issueType, setIssueType] = useState<IssueType>("task")
    return (
      <ButtonGroup className="border-input bg-background h-8 overflow-hidden rounded-md border">
        {issueTypeOptions.map(t => {
          const Icon = t.icon
          const isSelected = issueType === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setIssueType(t.value)}
              className={cn(
                "flex h-full items-center justify-center gap-1 px-2 text-xs transition-colors",
                isSelected ?
                  cn("text-white", t.selectedBg)
                : cn(t.color, t.unselectedBg, t.unselectedHover),
              )}
              aria-pressed={isSelected}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </ButtonGroup>
    )
  },
}

/** Configuration for task status display */
const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    color: "text-green-500",
    selectedBg: "bg-green-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-green-500/20",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    color: "text-blue-500",
    selectedBg: "bg-blue-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-blue-500/20",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    color: "text-red-500",
    selectedBg: "bg-red-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-red-500/20",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    color: "text-amber-500",
    selectedBg: "bg-amber-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-amber-500/20",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    color: "text-gray-500",
    selectedBg: "bg-gray-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-gray-500/20",
  },
}

const statusOptions: TaskStatus[] = ["open", "in_progress", "blocked", "deferred", "closed"]

const priorityOptions = [
  {
    value: 0,
    label: "P0 - Critical",
    short: "P0",
    color: "text-red-600",
    selectedBg: "bg-red-600",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-red-600/20",
  },
  {
    value: 1,
    label: "P1 - High",
    short: "P1",
    color: "text-orange-500",
    selectedBg: "bg-orange-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-orange-500/20",
  },
  {
    value: 2,
    label: "P2 - Medium",
    short: "P2",
    color: "text-amber-500",
    selectedBg: "bg-amber-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-amber-500/20",
  },
  {
    value: 3,
    label: "P3 - Low",
    short: "P3",
    color: "text-yellow-500",
    selectedBg: "bg-yellow-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-yellow-500/20",
  },
  {
    value: 4,
    label: "P4 - Lowest",
    short: "P4",
    color: "text-gray-500",
    selectedBg: "bg-gray-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-gray-500/20",
  },
]

const issueTypeOptions: {
  value: IssueType
  label: string
  icon: typeof IconCheckbox
  color: string
  selectedBg: string
  unselectedBg: string
  unselectedHover: string
}[] = [
  {
    value: "task",
    label: "Task",
    icon: IconCheckbox,
    color: "text-status-success",
    selectedBg: "bg-green-600",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-green-500/20",
  },
  {
    value: "bug",
    label: "Bug",
    icon: IconBug,
    color: "text-red-500",
    selectedBg: "bg-red-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-red-500/20",
  },
  {
    value: "epic",
    label: "Epic",
    icon: IconStack2,
    color: "text-indigo-500",
    selectedBg: "bg-indigo-500",
    unselectedBg: "bg-transparent",
    unselectedHover: "hover:bg-indigo-500/20",
  },
]

type TaskStatus = "open" | "in_progress" | "blocked" | "deferred" | "closed"

type IssueType = "task" | "bug" | "epic"

type StatusConfig = {
  icon: typeof IconCircle
  label: string
  color: string
  selectedBg: string
  unselectedBg: string
  unselectedHover: string
}

import type { Meta, StoryObj } from "@storybook/react"
import { useState, useCallback } from "react"
import { TaskDetails } from "./TaskDetails"
import type { TaskCardTask } from "@/types"
import type { IssueType, TaskFormValues } from "@/hooks/useTaskDetails"
import { Button } from "@/components/ui/button"

const meta: Meta<typeof TaskDetails> = {
  title: "Tasks/TaskDetails",
  component: TaskDetails,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof TaskDetails>

// Sample tasks for stories
const sampleTask: TaskCardTask = {
  id: "rui-123",
  title: "Implement task details dialog",
  description:
    "Create a dialog component that allows users to view and edit task details including title, description, status, and priority.",
  status: "in_progress",
  priority: 2,
  issue_type: "task",
  parent: "rui-epic-01",
}

const taskWithoutDescription: TaskCardTask = {
  id: "rui-456",
  title: "Fix bug in sidebar",
  status: "open",
  priority: 1,
}

const closedTask: TaskCardTask = {
  id: "rui-789",
  title: "Setup project structure",
  description: "Initial project setup with Vite and React",
  status: "closed",
  priority: 3,
  closed_at: "2024-01-15T10:00:00Z",
}

// Sample all tasks for parent selection
const allTasks: TaskCardTask[] = [
  sampleTask,
  taskWithoutDescription,
  closedTask,
  { id: "rui-epic-01", title: "Epic: UI Redesign", status: "in_progress", issue_type: "epic" },
  { id: "rui-epic-02", title: "Epic: Performance", status: "open", issue_type: "epic" },
]

// Interactive wrapper component that manages state
function TaskDetailsDemo({
  initialTask,
  readOnly = false,
  initialLabels = [],
}: {
  initialTask: TaskCardTask
  readOnly?: boolean
  initialLabels?: string[]
}) {
  const [open, setOpen] = useState(true)
  const [task] = useState(initialTask)
  const [formValues, setFormValues] = useState<TaskFormValues>({
    title: initialTask.title,
    description: initialTask.description ?? "",
    status: initialTask.status,
    priority: initialTask.priority ?? 2,
    issueType: (initialTask.issue_type as IssueType) ?? "task",
    parent: initialTask.parent ?? null,
  })
  const [labels, setLabels] = useState<string[]>(initialLabels)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isAddingLabel, setIsAddingLabel] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [deleteError] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState("")
  const [showLabelInput, setShowLabelInput] = useState(false)

  // Simulate save with delay
  const handleSave = useCallback(async (field: keyof TaskFormValues, value: unknown) => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    setFormValues(prev => ({ ...prev, [field]: value }))
    setIsSaving(false)
    console.log(`Saved ${field}:`, value)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  const handleAddLabel = useCallback(async () => {
    if (!newLabel.trim()) return
    setIsAddingLabel(true)
    await new Promise(resolve => setTimeout(resolve, 200))
    setLabels(prev => [...prev, newLabel.trim()])
    setNewLabel("")
    setShowLabelInput(false)
    setIsAddingLabel(false)
  }, [newLabel])

  const handleRemoveLabel = useCallback(async (label: string) => {
    setLabels(prev => prev.filter(l => l !== label))
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsDeleting(false)
    setOpen(false)
    console.log("Task deleted")
  }, [])

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <Button onClick={() => setOpen(true)}>Open Task Details</Button>
        <p className="text-muted-foreground text-sm">
          Current task: {formValues.title} ({formValues.status})
        </p>
      </div>
      <div className="h-full w-[400px]">
        <TaskDetails
          task={task}
          open={open}
          readOnly={readOnly}
          formValues={formValues}
          labels={labels}
          issuePrefix="rui-"
          allTasks={allTasks}
          isSaving={isSaving}
          isDeleting={isDeleting}
          isAddingLabel={isAddingLabel}
          isConfirmingDelete={isConfirmingDelete}
          deleteError={deleteError}
          newLabel={newLabel}
          showLabelInput={showLabelInput}
          canDelete={!readOnly}
          onUpdateTitle={title => handleSave("title", title)}
          onUpdateDescription={desc => handleSave("description", desc)}
          onUpdateStatus={status => handleSave("status", status)}
          onUpdatePriority={priority => handleSave("priority", priority)}
          onUpdateIssueType={type => handleSave("issueType", type)}
          onUpdateParent={parent => handleSave("parent", parent)}
          onSetNewLabel={setNewLabel}
          onSetShowLabelInput={setShowLabelInput}
          onAddLabel={handleAddLabel}
          onRemoveLabel={handleRemoveLabel}
          onStartDelete={() => setIsConfirmingDelete(true)}
          onCancelDelete={() => setIsConfirmingDelete(false)}
          onConfirmDelete={handleConfirmDelete}
          onClose={handleClose}
        />
      </div>
    </div>
  )
}

// Stories

export const Default: Story = {
  render: () => <TaskDetailsDemo initialTask={sampleTask} />,
}

export const ReadOnly: Story = {
  render: () => <TaskDetailsDemo initialTask={sampleTask} readOnly />,
}

export const NoDescription: Story = {
  render: () => <TaskDetailsDemo initialTask={taskWithoutDescription} />,
}

export const ClosedTask: Story = {
  render: () => <TaskDetailsDemo initialTask={closedTask} />,
}

export const WithLabels: Story = {
  render: () => (
    <TaskDetailsDemo initialTask={sampleTask} initialLabels={["urgent", "frontend", "design"]} />
  ),
}

export const HighPriority: Story = {
  render: () => (
    <TaskDetailsDemo
      initialTask={{
        id: "rui-urgent",
        title: "Critical security fix",
        description: "Fix XSS vulnerability in user input handling",
        status: "open",
        priority: 0,
        issue_type: "bug",
      }}
    />
  ),
}

export const BlockedTask: Story = {
  render: () => (
    <TaskDetailsDemo
      initialTask={{
        id: "rui-blocked",
        title: "Implement API integration",
        description: "Waiting for backend team to deploy API endpoints",
        status: "blocked",
        priority: 2,
        issue_type: "task",
      }}
    />
  ),
}

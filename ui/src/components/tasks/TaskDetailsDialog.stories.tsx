import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { TaskDetailsDialog, type TaskUpdateData } from "./TaskDetailsDialog"
import type { TaskCardTask } from "./TaskCard"
import { Button } from "@/components/ui/button"

const meta: Meta<typeof TaskDetailsDialog> = {
  title: "Tasks/TaskDetailsDialog",
  component: TaskDetailsDialog,
  parameters: {
    layout: "centered",
  },
}

export default meta
type Story = StoryObj<typeof TaskDetailsDialog>

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

// Interactive wrapper component
function DialogDemo({
  initialTask,
  readOnly = false,
}: {
  initialTask: TaskCardTask
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [task, setTask] = useState(initialTask)

  const handleSave = async (id: string, updates: TaskUpdateData) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))

    // Update local state (convert null parent to undefined for TaskCardTask compatibility)
    setTask(prev => ({
      ...prev,
      ...updates,
      parent: updates.parent === null ? undefined : (updates.parent ?? prev.parent),
    }))

    console.log("Saved task:", id, updates)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <p className="text-muted-foreground text-sm">
        Current task: {task.title} ({task.status})
      </p>
      <TaskDetailsDialog
        task={task}
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
        readOnly={readOnly}
      />
    </div>
  )
}

// Stories

export const Default: Story = {
  render: () => <DialogDemo initialTask={sampleTask} />,
}

export const ReadOnly: Story = {
  render: () => <DialogDemo initialTask={sampleTask} readOnly />,
}

export const NoDescription: Story = {
  render: () => <DialogDemo initialTask={taskWithoutDescription} />,
}

export const ClosedTask: Story = {
  render: () => <DialogDemo initialTask={closedTask} />,
}

export const HighPriority: Story = {
  render: () => (
    <DialogDemo
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
    <DialogDemo
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

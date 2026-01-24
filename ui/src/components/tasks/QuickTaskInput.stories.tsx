import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn, waitFor } from "storybook/test"
import { QuickTaskInput } from "./QuickTaskInput"
import { clearTaskInputStorage, mockFetch, wait } from "../../../.storybook/test-utils"
import { TASK_INPUT_DRAFT_STORAGE_KEY } from "@/constants"

const meta: Meta<typeof QuickTaskInput> = {
  title: "Tasks/QuickTaskInput",
  component: QuickTaskInput,
  parameters: {
    layout: "padded",
  },
  decorators: [
    Story => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    onTaskCreated: fn(),
    onError: fn(),
  },
  beforeEach: () => {
    // Clear localStorage before each story
    clearTaskInputStorage()
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomPlaceholder: Story = {
  args: {
    placeholder: "What needs to be done?",
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const WithLabel: Story = {
  render: args => (
    <div className="space-y-2">
      <label className="text-sm font-medium">Add New Task</label>
      <QuickTaskInput {...args} />
    </div>
  ),
}

export const InCard: Story = {
  render: args => (
    <div className="border-border bg-card rounded-lg border p-4">
      <h3 className="mb-3 text-lg font-semibold">Quick Add</h3>
      <QuickTaskInput {...args} />
    </div>
  ),
}

/**
 * Verifies input is cleared after successful task submission.
 * Migrated from Playwright test: "clears input after successful task submission"
 */
export const ClearsInputOnSuccess: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const taskTitle = `Test Task ${Date.now()}`

    // Mock successful API response
    const cleanup = mockFetch({
      url: "/api/tasks",
      method: "POST",
      status: 200,
      body: {
        ok: true,
        issue: {
          id: "test-123",
          title: taskTitle,
          status: "open",
          priority: 2,
          issue_type: "task",
        },
      },
    })

    try {
      // Get the textarea
      const input = canvas.getByRole("textbox", { name: "New task title" })

      // Type a task title
      await userEvent.type(input, taskTitle)
      await expect(input).toHaveValue(taskTitle)

      // Submit by pressing Enter
      await userEvent.keyboard("{Enter}")

      // Wait for input to be cleared (indicates API call succeeded)
      await waitFor(
        () => {
          expect(input).toHaveValue("")
        },
        { timeout: 5000 },
      )

      // Callback should have been called
      await expect(args.onTaskCreated).toHaveBeenCalled()
    } finally {
      cleanup()
    }
  },
}

/**
 * Verifies localStorage draft is cleared after successful task submission.
 * Migrated from Playwright test: "clears localStorage draft after successful task submission"
 */
export const ClearsLocalStorageOnSuccess: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const taskTitle = `Storage Test ${Date.now()}`

    // Mock successful API response
    const cleanup = mockFetch({
      url: "/api/tasks",
      method: "POST",
      status: 200,
      body: {
        ok: true,
        issue: {
          id: "test-456",
          title: taskTitle,
          status: "open",
          priority: 2,
          issue_type: "task",
        },
      },
    })

    try {
      // Get the textarea
      const input = canvas.getByRole("textbox", { name: "New task title" })

      // Type a task title
      await userEvent.type(input, taskTitle)

      // Verify localStorage has the draft
      await waitFor(() => {
        expect(localStorage.getItem(TASK_INPUT_DRAFT_STORAGE_KEY)).toBe(taskTitle)
      })

      // Submit by pressing Enter
      await userEvent.keyboard("{Enter}")

      // Wait for localStorage to be cleared
      await waitFor(
        () => {
          expect(localStorage.getItem(TASK_INPUT_DRAFT_STORAGE_KEY)).toBeNull()
        },
        { timeout: 5000 },
      )
    } finally {
      cleanup()
    }
  },
}

/**
 * Verifies focus is retained on input after successful submission.
 * Migrated from Playwright test: "retains focus on input after successful submission"
 */
export const RetainsFocusOnSuccess: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const taskTitle = `Focus Test ${Date.now()}`

    // Mock successful API response
    const cleanup = mockFetch({
      url: "/api/tasks",
      method: "POST",
      status: 200,
      body: {
        ok: true,
        issue: {
          id: "test-789",
          title: taskTitle,
          status: "open",
          priority: 2,
          issue_type: "task",
        },
      },
    })

    try {
      // Get the textarea
      const input = canvas.getByRole("textbox", { name: "New task title" })

      // Focus and type
      await userEvent.click(input)
      await userEvent.type(input, taskTitle)

      // Submit by pressing Enter
      await userEvent.keyboard("{Enter}")

      // Wait for input to be cleared and re-focused
      await waitFor(
        () => {
          expect(input).toHaveValue("")
        },
        { timeout: 5000 },
      )

      // Wait a bit for the setTimeout refocus to complete
      await wait(100)

      // Focus should be back on the input
      await expect(input).toHaveFocus()
    } finally {
      cleanup()
    }
  },
}

/**
 * Verifies input value is retained when API returns an error.
 * Migrated from Playwright test: "keeps input value on API error"
 */
export const KeepsInputOnError: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const taskTitle = `Error Test ${Date.now()}`

    // Mock API error response
    const cleanup = mockFetch({
      url: "/api/tasks",
      method: "POST",
      status: 500,
      body: { ok: false, error: "Server error" },
    })

    try {
      // Get the textarea
      const input = canvas.getByRole("textbox", { name: "New task title" })

      // Type a task title
      await userEvent.type(input, taskTitle)

      // Submit by pressing Enter
      await userEvent.keyboard("{Enter}")

      // Wait for the error to be processed
      await waitFor(
        () => {
          expect(args.onError).toHaveBeenCalled()
        },
        { timeout: 5000 },
      )

      // Input should retain its value on error
      await expect(input).toHaveValue(taskTitle)
    } finally {
      cleanup()
    }
  },
}

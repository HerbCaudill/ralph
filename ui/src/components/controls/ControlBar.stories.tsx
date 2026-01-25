import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, waitFor } from "storybook/test"
import { ControlBar } from "./ControlBar"
import { withStoreState } from "../../../.storybook/decorators"
import { mockFetch } from "../../../.storybook/test-utils"

const meta: Meta<typeof ControlBar> = {
  title: "Layout/ControlBar",
  component: ControlBar,
  parameters: {},
}

export default meta
type Story = StoryObj<typeof meta>

export const Stopped: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
}

export const Starting: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "starting",
    }),
  ],
}

export const Running: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "running",
    }),
  ],
}

export const Stopping: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopping",
    }),
  ],
}

export const Disconnected: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "disconnected",
      ralphStatus: "stopped",
    }),
  ],
}

export const Connecting: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connecting",
      ralphStatus: "stopped",
    }),
  ],
}

export const InCard: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
  render: args => (
    <div className="border-border bg-card flex items-center gap-4 rounded-lg border p-4">
      <span className="text-muted-foreground text-sm">Agent Controls:</span>
      <ControlBar {...args} />
    </div>
  ),
}

export const AllStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="w-24 text-sm">Stopped:</span>
        <ControlBar />
      </div>
    </div>
  ),
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
}

/**
 * Verifies all four control buttons render.
 */
export const RendersAllButtons: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // All buttons should be visible
    await expect(canvas.getByRole("button", { name: "Start" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Pause" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Stop" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Stop after current action" })).toBeVisible()
  },
}

/**
 * Verifies button states when stopped: Start enabled, others disabled.
 */
export const ButtonStatesWhenStopped: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Start should be enabled when stopped
    await expect(canvas.getByRole("button", { name: "Start" })).not.toBeDisabled()

    // All other buttons should be disabled
    await expect(canvas.getByRole("button", { name: "Pause" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Stop" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Stop after current action" })).toBeDisabled()
  },
}

/**
 * Verifies button states when running: Start disabled, others enabled.
 */
export const ButtonStatesWhenRunning: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "running",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Start should be disabled when running
    await expect(canvas.getByRole("button", { name: "Start" })).toBeDisabled()

    // Pause, Stop, and Stop after current should be enabled
    await expect(canvas.getByRole("button", { name: "Pause" })).not.toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Stop" })).not.toBeDisabled()
    await expect(
      canvas.getByRole("button", { name: "Stop after current action" }),
    ).not.toBeDisabled()
  },
}

/**
 * Verifies all buttons are disabled when disconnected.
 */
export const AllButtonsDisabledWhenDisconnected: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "disconnected",
      ralphStatus: "stopped",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // All buttons should be disabled when not connected
    await expect(canvas.getByRole("button", { name: "Start" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Pause" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Stop" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Stop after current action" })).toBeDisabled()
  },
}

/**
 * Verifies button label changes to "Resume" when paused.
 */
export const ShowsResumeWhenPaused: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "paused",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Should show Resume instead of Pause when paused
    await expect(canvas.getByRole("button", { name: "Resume" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Resume" })).not.toBeDisabled()

    // Pause button should not exist (replaced by Resume)
    await expect(canvas.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument()
  },
}

/**
 * Verifies button label changes to "Cancel stop after current" when in stopping_after_current state.
 */
export const ShowsCancelStopAfterCurrentWhenStoppingAfterCurrent: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopping_after_current",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Should show "Cancel stop after current" instead of "Stop after current action"
    await expect(canvas.getByRole("button", { name: "Cancel stop after current" })).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "Cancel stop after current" }),
    ).not.toBeDisabled()

    // Original label should not exist
    await expect(
      canvas.queryByRole("button", { name: "Stop after current action" }),
    ).not.toBeInTheDocument()
  },
}

/**
 * Verifies Start button click triggers API call.
 */
export const StartButtonCallsApi: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    let apiCalled = false

    // Mock the API call
    const cleanup = mockFetch({
      url: "/api/ralph/default/start",
      method: "POST",
      status: 200,
      body: { ok: true, status: "starting" },
    })

    // Override to track if called
    const originalFetch = window.fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/start")) {
        apiCalled = true
      }
      return originalFetch(input, init)
    }

    try {
      // Click the Start button
      const startButton = canvas.getByRole("button", { name: "Start" })
      await userEvent.click(startButton)

      // API should have been called
      await waitFor(() => {
        expect(apiCalled).toBe(true)
      })
    } finally {
      cleanup()
    }
  },
}

/**
 * Verifies Stop button click triggers API call.
 */
export const StopButtonCallsApi: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "running",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    let apiCalled = false

    // Override fetch to track if called
    const originalFetch = window.fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/stop") && !url.includes("stop-after")) {
        apiCalled = true
        return new Response(JSON.stringify({ ok: true, status: "stopping" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return originalFetch(input, init)
    }

    try {
      // Click the Stop button
      const stopButton = canvas.getByRole("button", { name: "Stop" })
      await userEvent.click(stopButton)

      // API should have been called
      await waitFor(() => {
        expect(apiCalled).toBe(true)
      })
    } finally {
      window.fetch = originalFetch
    }
  },
}

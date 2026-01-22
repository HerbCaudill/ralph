import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect } from "react"
import { InstanceSelector } from "./InstanceSelector"
import { useAppStore, createRalphInstance } from "@/store"

const meta: Meta<typeof InstanceSelector> = {
  title: "Layout/InstanceSelector",
  component: InstanceSelector,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    Story => {
      // Reset store before each story
      useAppStore.getState().reset()
      return <Story />
    },
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithTextColor: Story = {
  args: {
    textColor: "#ffffff",
  },
  decorators: [
    Story => (
      <div className="bg-status-success rounded-lg p-4">
        <Story />
      </div>
    ),
  ],
}

export const SingleInstanceStopped: Story = {
  decorators: [
    Story => {
      useAppStore.getState().reset()
      return <Story />
    },
  ],
}

export const SingleInstanceRunning: Story = {
  decorators: [
    Story => {
      const SetupStore = () => {
        useEffect(() => {
          useAppStore.getState().setRalphStatus("running")
        }, [])
        return null
      }
      return (
        <>
          <SetupStore />
          <Story />
        </>
      )
    },
  ],
}

export const MultipleInstances: Story = {
  decorators: [
    Story => {
      const SetupStore = () => {
        useEffect(() => {
          const instances = new Map()

          const main = createRalphInstance("default", "Main", "Ralph")
          main.status = "running"
          instances.set("default", main)

          const worktree1 = createRalphInstance("worktree-1", "Worktree 1", "Ralph-2")
          worktree1.status = "paused"
          instances.set("worktree-1", worktree1)

          const worktree2 = createRalphInstance("worktree-2", "Worktree 2", "Ralph-3")
          worktree2.status = "running"
          instances.set("worktree-2", worktree2)

          useAppStore.setState({ instances })
        }, [])
        return null
      }
      return (
        <>
          <SetupStore />
          <Story />
        </>
      )
    },
  ],
}

export const VariousStatuses: Story = {
  decorators: [
    Story => {
      const SetupStore = () => {
        useEffect(() => {
          const instances = new Map()

          const main = createRalphInstance("default", "Main", "Ralph")
          main.status = "running"
          instances.set("default", main)

          const starting = createRalphInstance("starting-1", "Starting Instance", "Ralph-2")
          starting.status = "starting"
          instances.set("starting-1", starting)

          const paused = createRalphInstance("paused-1", "Paused Instance", "Ralph-3")
          paused.status = "paused"
          instances.set("paused-1", paused)

          const stopping = createRalphInstance("stopping-1", "Stopping Instance", "Ralph-4")
          stopping.status = "stopping"
          instances.set("stopping-1", stopping)

          const stopped = createRalphInstance("stopped-1", "Stopped Instance", "Ralph-5")
          stopped.status = "stopped"
          instances.set("stopped-1", stopped)

          useAppStore.setState({ instances })
        }, [])
        return null
      }
      return (
        <>
          <SetupStore />
          <Story />
        </>
      )
    },
  ],
}

export const InHeader: Story = {
  args: {
    textColor: "#ffffff",
  },
  decorators: [
    Story => {
      const SetupStore = () => {
        useEffect(() => {
          const instances = new Map()

          const main = createRalphInstance("default", "Main", "Ralph")
          main.status = "running"
          instances.set("default", main)

          const worktree1 = createRalphInstance("worktree-1", "Feature Branch", "Ralph-2")
          worktree1.status = "running"
          instances.set("worktree-1", worktree1)

          useAppStore.setState({ instances })
        }, [])
        return null
      }
      return (
        <div className="flex h-14 w-96 items-center rounded-lg bg-blue-600 px-4">
          <SetupStore />
          <Story />
        </div>
      )
    },
  ],
}

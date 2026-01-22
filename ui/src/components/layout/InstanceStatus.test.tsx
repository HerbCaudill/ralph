import { render, screen, act } from "@/test-utils"
import { describe, it, expect, beforeEach } from "vitest"
import { InstanceStatus } from "./InstanceStatus"
import { useAppStore, createRalphInstance, DEFAULT_AGENT_NAME } from "@/store"

describe("InstanceStatus", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it("does not render when status is stopped", () => {
    render(<InstanceStatus />)
    expect(screen.queryByTestId("instance-status")).not.toBeInTheDocument()
  })

  it("does not render when status is starting", () => {
    act(() => {
      useAppStore.getState().setRalphStatus("starting")
    })
    render(<InstanceStatus />)
    expect(screen.queryByTestId("instance-status")).not.toBeInTheDocument()
  })

  it("renders when status is running without task", () => {
    act(() => {
      useAppStore.getState().setRalphStatus("running")
    })
    render(<InstanceStatus />)

    const status = screen.getByTestId("instance-status")
    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent(DEFAULT_AGENT_NAME)
    expect(status).toHaveTextContent("running")
  })

  it("renders agent name and task title when running with task", () => {
    act(() => {
      const store = useAppStore.getState()
      const instances = new Map(store.instances)
      const defaultInstance = instances.get("default")!
      instances.set("default", {
        ...defaultInstance,
        status: "running",
        currentTaskTitle: "Fix login bug",
      })
      useAppStore.setState({ instances, ralphStatus: "running" })
    })
    render(<InstanceStatus />)

    const status = screen.getByTestId("instance-status")
    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent(DEFAULT_AGENT_NAME)
    expect(status).toHaveTextContent("running 'Fix login bug'")
  })

  it("shows paused status when paused", () => {
    act(() => {
      const store = useAppStore.getState()
      const instances = new Map(store.instances)
      const defaultInstance = instances.get("default")!
      instances.set("default", {
        ...defaultInstance,
        status: "paused",
        currentTaskTitle: "Add feature",
      })
      useAppStore.setState({ instances, ralphStatus: "paused" })
    })
    render(<InstanceStatus />)

    const status = screen.getByTestId("instance-status")
    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent("paused on 'Add feature'")
  })

  it("shows custom agent name for non-default instance", () => {
    act(() => {
      const store = useAppStore.getState()
      const instances = new Map(store.instances)
      const customInstance = createRalphInstance("custom", "Worktree 1", "Alice")
      customInstance.status = "running"
      customInstance.currentTaskTitle = "Write tests"
      instances.set("custom", customInstance)
      useAppStore.setState({
        instances,
        activeInstanceId: "custom",
        ralphStatus: "running",
      })
    })
    render(<InstanceStatus />)

    const status = screen.getByTestId("instance-status")
    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent("Alice:")
    expect(status).toHaveTextContent("running 'Write tests'")
  })

  it("applies custom className", () => {
    act(() => {
      useAppStore.getState().setRalphStatus("running")
    })
    render(<InstanceStatus className="custom-class" />)

    const status = screen.getByTestId("instance-status")
    expect(status).toHaveClass("custom-class")
  })

  it("applies text color style", () => {
    act(() => {
      useAppStore.getState().setRalphStatus("running")
    })
    render(<InstanceStatus textColor="#ff5733" />)

    const status = screen.getByTestId("instance-status")
    expect(status).toHaveStyle({ color: "#ff5733" })
  })
})

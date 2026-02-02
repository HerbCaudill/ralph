import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { InstanceSelectorController } from ".././InstanceSelectorController"
import { useAppStore, createRalphInstance } from "@/store"

describe("InstanceSelectorController", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().reset()
  })

  it("renders with default instance", () => {
    render(<InstanceSelectorController />)

    expect(screen.getByTestId("instance-selector")).toBeInTheDocument()
    expect(screen.getByText("Main")).toBeInTheDocument()
  })

  it("shows status indicator for active instance", () => {
    render(<InstanceSelectorController />)

    const statusIndicator = screen.getByTestId("instance-selector-status")
    expect(statusIndicator).toBeInTheDocument()
    // Default status is "stopped" which uses neutral color
    expect(statusIndicator).toHaveClass("bg-status-neutral")
  })

  it("shows running status indicator when instance is running", () => {
    useAppStore.getState().setRalphStatus("running")

    render(<InstanceSelectorController />)

    const statusIndicator = screen.getByTestId("instance-selector-status")
    expect(statusIndicator).toHaveClass("bg-status-success")
  })

  it("shows starting status indicator with animation", () => {
    useAppStore.getState().setRalphStatus("starting")

    render(<InstanceSelectorController />)

    const statusIndicator = screen.getByTestId("instance-selector-status")
    expect(statusIndicator).toHaveClass("bg-status-warning")
    expect(statusIndicator).toHaveClass("animate-pulse")
  })

  it("toggles dropdown when clicked", () => {
    render(<InstanceSelectorController />)

    // Dropdown should be closed initially
    expect(screen.queryByTestId("instance-selector-dropdown")).not.toBeInTheDocument()

    // Click the selector button
    fireEvent.click(screen.getByTestId("instance-selector"))

    // Dropdown should be open
    expect(screen.getByTestId("instance-selector-dropdown")).toBeInTheDocument()
    expect(screen.getByText("Instances")).toBeInTheDocument()
  })

  it("shows all instances in dropdown", () => {
    // Add a second instance manually via store
    const instances = new Map(useAppStore.getState().instances)
    const newInstance = createRalphInstance("instance-2", "Worktree 1", "Ralph-2")
    newInstance.status = "running"
    instances.set("instance-2", newInstance)
    useAppStore.setState({ instances })

    render(<InstanceSelectorController />)

    // Open dropdown
    fireEvent.click(screen.getByTestId("instance-selector"))

    // Should show both instances (using testids to avoid ambiguity with button text)
    expect(screen.getByTestId("instance-option-default")).toBeInTheDocument()
    expect(screen.getByTestId("instance-option-instance-2")).toBeInTheDocument()
    // Check that the dropdown has "Worktree 1" as the second instance name
    expect(screen.getByTestId("instance-option-instance-2")).toHaveTextContent("Worktree 1")
  })

  it("shows status label for each instance in dropdown", () => {
    // Add instances with different statuses
    const instances = new Map(useAppStore.getState().instances)
    const runningInstance = createRalphInstance("running-1", "Running Instance", "Ralph-2")
    runningInstance.status = "running"
    instances.set("running-1", runningInstance)
    useAppStore.setState({ instances })

    render(<InstanceSelectorController />)

    // Open dropdown
    fireEvent.click(screen.getByTestId("instance-selector"))

    // Should show status labels
    expect(screen.getByText("Stopped")).toBeInTheDocument()
    expect(screen.getByText("Running")).toBeInTheDocument()
  })

  it("marks active instance with checkmark", () => {
    render(<InstanceSelectorController />)

    // Open dropdown
    fireEvent.click(screen.getByTestId("instance-selector"))

    // Active instance option should have aria-selected
    const activeOption = screen.getByTestId("instance-option-default")
    expect(activeOption).toHaveAttribute("aria-selected", "true")
  })

  it("closes dropdown when clicking outside", () => {
    render(<InstanceSelectorController />)

    // Open dropdown
    fireEvent.click(screen.getByTestId("instance-selector"))
    expect(screen.getByTestId("instance-selector-dropdown")).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(document.body)

    // Dropdown should be closed
    expect(screen.queryByTestId("instance-selector-dropdown")).not.toBeInTheDocument()
  })

  it("shows 'New Instance' action button", () => {
    render(<InstanceSelectorController />)

    // Open dropdown
    fireEvent.click(screen.getByTestId("instance-selector"))

    expect(screen.getByTestId("instance-selector-new")).toBeInTheDocument()
    expect(screen.getByText("New Instance")).toBeInTheDocument()
  })

  it("shows running count badge when multiple instances are running", () => {
    // Add multiple running instances
    const instances = new Map(useAppStore.getState().instances)

    const instance1 = createRalphInstance("default", "Main", "Ralph")
    instance1.status = "running"
    instances.set("default", instance1)

    const instance2 = createRalphInstance("instance-2", "Worktree 1", "Ralph-2")
    instance2.status = "running"
    instances.set("instance-2", instance2)

    useAppStore.setState({ instances })

    render(<InstanceSelectorController />)

    // Should show count of running instances
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("does not show running count badge when only one instance is running", () => {
    useAppStore.getState().setRalphStatus("running")

    render(<InstanceSelectorController />)

    // Should not show a badge with "1"
    expect(screen.queryByText("1")).not.toBeInTheDocument()
  })

  it("applies custom className", () => {
    const { container } = render(<InstanceSelectorController className="custom-class" />)
    expect(container.firstChild).toHaveClass("custom-class")
  })

  it("applies textColor to button", () => {
    render(<InstanceSelectorController textColor="#ffffff" />)

    const button = screen.getByTestId("instance-selector")
    expect(button).toHaveStyle({ color: "#ffffff" })
  })

  it("has proper ARIA attributes", () => {
    render(<InstanceSelectorController />)

    const button = screen.getByTestId("instance-selector")
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(button).toHaveAttribute("aria-haspopup", "listbox")

    // Open dropdown
    fireEvent.click(button)

    expect(button).toHaveAttribute("aria-expanded", "true")

    const dropdown = screen.getByTestId("instance-selector-dropdown")
    expect(dropdown).toHaveAttribute("role", "listbox")
  })

  it("shows paused status indicator", () => {
    useAppStore.getState().setRalphStatus("paused")

    render(<InstanceSelectorController />)

    const statusIndicator = screen.getByTestId("instance-selector-status")
    expect(statusIndicator).toHaveClass("bg-status-warning")
  })

  it("shows stopping status indicator with animation", () => {
    useAppStore.getState().setRalphStatus("stopping")

    render(<InstanceSelectorController />)

    const statusIndicator = screen.getByTestId("instance-selector-status")
    expect(statusIndicator).toHaveClass("bg-status-warning")
    expect(statusIndicator).toHaveClass("animate-pulse")
  })
})

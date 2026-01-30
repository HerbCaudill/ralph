import { render, screen, fireEvent, waitFor } from "@/test-utils"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventStream } from "./EventStream"
import type { EventStreamProps } from "./EventStream"

// Mock the startRalph function
const mockStartRalph = vi.fn()
vi.mock("@/lib/startRalph", () => ({
  startRalph: () => mockStartRalph(),
}))

// Default props for testing
const defaultProps: EventStreamProps = {
  sessionEvents: [],
  ralphStatus: "stopped",
  isViewingLatest: true,
  isViewingHistorical: false,
  isRunning: false,
  isConnected: true,
  sessionTask: null,
  sessions: [],
  isLoadingSessions: false,
  isLoadingHistoricalEvents: false,
  issuePrefix: null,
  navigation: {
    selectSessionHistory: vi.fn(),
    returnToLive: vi.fn(),
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    hasPrevious: false,
    hasNext: false,
  },
}

describe("EventStream", () => {
  beforeEach(() => {
    mockStartRalph.mockReset()
  })

  describe("Start button UI", () => {
    it("shows 'Ralph is not running' message and Start button when stopped and connected", () => {
      render(
        <EventStream
          {...defaultProps}
          ralphStatus="stopped"
          isConnected={true}
          isRunning={false}
          sessionEvents={[]}
        />,
      )

      // Should show the "Ralph is not running" message
      expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
      expect(screen.getByText("Click Start to begin working on open tasks")).toBeInTheDocument()

      // Should show the Start button
      const startButton = screen.getByTestId("ralph-start-button")
      expect(startButton).toBeInTheDocument()
      expect(startButton).toHaveTextContent("Start")
    })

    it("shows spinner when Ralph is running", () => {
      render(
        <EventStream
          {...defaultProps}
          ralphStatus="running"
          isConnected={true}
          isRunning={true}
          sessionEvents={[
            {
              type: "user_message",
              timestamp: Date.now(),
              message: "Test message",
            },
          ]}
        />,
      )

      // Should show the running spinner
      expect(screen.getByTestId("ralph-running-spinner")).toBeInTheDocument()
      expect(screen.getByLabelText("Ralph is running")).toBeInTheDocument()

      // Should NOT show the Start button
      expect(screen.queryByTestId("ralph-start-button")).not.toBeInTheDocument()
      expect(screen.queryByText("Ralph is not running")).not.toBeInTheDocument()
    })

    it("shows spinner when not connected (waiting for connection)", () => {
      render(
        <EventStream
          {...defaultProps}
          ralphStatus="stopped"
          isConnected={false}
          isRunning={false}
          sessionEvents={[]}
        />,
      )

      // Should show a spinner in the empty state (not the "Ralph is not running" message)
      // because we're waiting for connection
      expect(screen.queryByText("Ralph is not running")).not.toBeInTheDocument()
      expect(screen.queryByTestId("ralph-start-button")).not.toBeInTheDocument()

      // Should have a spinner in the empty state container
      const logContainer = screen.getByRole("log")
      expect(logContainer.querySelector("svg")).toBeInTheDocument()
    })

    it("calls startRalph when Start button is clicked", async () => {
      render(
        <EventStream
          {...defaultProps}
          ralphStatus="stopped"
          isConnected={true}
          isRunning={false}
          sessionEvents={[]}
        />,
      )

      const startButton = screen.getByTestId("ralph-start-button")
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockStartRalph).toHaveBeenCalledTimes(1)
      })
    })

    it("shows spinner in empty state when starting", () => {
      render(
        <EventStream
          {...defaultProps}
          ralphStatus="starting"
          isConnected={true}
          isRunning={true}
          sessionEvents={[]}
        />,
      )

      // Should not show the "Ralph is not running" message when starting
      expect(screen.queryByText("Ralph is not running")).not.toBeInTheDocument()
      expect(screen.queryByTestId("ralph-start-button")).not.toBeInTheDocument()

      // Should show a spinner
      const logContainer = screen.getByRole("log")
      expect(logContainer.querySelector("svg")).toBeInTheDocument()
    })

    it("shows idle spinner when stopped with content", () => {
      render(
        <EventStream
          {...defaultProps}
          ralphStatus="stopped"
          isConnected={true}
          isRunning={false}
          sessionEvents={[
            {
              type: "user_message",
              timestamp: Date.now(),
              message: "Test message",
            },
          ]}
        />,
      )

      // Should show the idle spinner when there's content
      expect(screen.getByTestId("ralph-idle-spinner")).toBeInTheDocument()
      expect(screen.getByLabelText("Ralph is idle")).toBeInTheDocument()

      // Should NOT show the Start button in the main content area
      // (empty state is not shown when there's content)
      expect(screen.queryByTestId("ralph-start-button")).not.toBeInTheDocument()
    })

    it("does not show spinners when viewing historical session", () => {
      render(
        <EventStream
          {...defaultProps}
          ralphStatus="running"
          isConnected={true}
          isRunning={true}
          isViewingLatest={false}
          isViewingHistorical={true}
          sessionEvents={[
            {
              type: "user_message",
              timestamp: Date.now(),
              message: "Historical message",
            },
          ]}
        />,
      )

      // Should NOT show running or idle spinners when viewing historical session
      expect(screen.queryByTestId("ralph-running-spinner")).not.toBeInTheDocument()
      expect(screen.queryByTestId("ralph-idle-spinner")).not.toBeInTheDocument()
    })

    it("shows loading state when loading historical events", () => {
      render(
        <EventStream
          {...defaultProps}
          isViewingLatest={false}
          isViewingHistorical={true}
          isLoadingHistoricalEvents={true}
          sessionEvents={[]}
        />,
      )

      // Should show "Loading session..." text
      expect(screen.getByText("Loading session...")).toBeInTheDocument()
    })
  })
})

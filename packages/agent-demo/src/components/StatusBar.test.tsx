import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { StatusBar } from "./StatusBar"
import type { ChatEvent } from "@herbcaudill/agent-view"

// Mock useTokenUsage so we can control its return value without real events
vi.mock("@herbcaudill/agent-view", () => ({
  useTokenUsage: vi.fn(() => ({ input: 0, output: 0 })),
  useContextWindow: vi.fn(() => ({ used: 0, max: 200_000 })),
  TokenUsageDisplay: ({ tokenUsage }: { tokenUsage: { input: number; output: number } }) => {
    const fmt = (n: number) =>
      n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k`
      : String(n)
    return <span>{`${fmt(tokenUsage.input)} in / ${fmt(tokenUsage.output)} out`}</span>
  },
  ContextWindowProgress: () => <div data-testid="context-window-progress" />,
}))

// Import the mock so we can change its return value per test
import { useTokenUsage } from "@herbcaudill/agent-view"
const mockUseTokenUsage = vi.mocked(useTokenUsage)

describe("StatusBar", () => {
  const defaultProps = {
    connectionStatus: "connected" as const,
    isStreaming: false,
    agentType: "claude" as const,
    events: [] as ChatEvent[],
    error: null,
  }

  describe("connection status", () => {
    it("shows 'connected' when connection status is connected", () => {
      render(<StatusBar {...defaultProps} connectionStatus="connected" />)
      expect(screen.getByText("connected")).toBeInTheDocument()
    })

    it("shows 'connecting' when connection status is connecting", () => {
      render(<StatusBar {...defaultProps} connectionStatus="connecting" />)
      expect(screen.getByText("connecting")).toBeInTheDocument()
    })

    it("shows 'disconnected' when connection status is disconnected", () => {
      render(<StatusBar {...defaultProps} connectionStatus="disconnected" />)
      expect(screen.getByText("disconnected")).toBeInTheDocument()
    })
  })

  describe("agent type", () => {
    it("shows 'Claude Code' when agent type is claude", () => {
      render(<StatusBar {...defaultProps} agentType="claude" />)
      expect(screen.getByText("Claude Code")).toBeInTheDocument()
    })

    it("shows 'Codex' when agent type is codex", () => {
      render(<StatusBar {...defaultProps} agentType="codex" />)
      expect(screen.getByText("Codex")).toBeInTheDocument()
    })
  })

  describe("streaming indicator", () => {
    it("shows spinner when streaming", () => {
      const { container } = render(<StatusBar {...defaultProps} isStreaming={true} />)
      expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    })

    it("does not show spinner when not streaming", () => {
      const { container } = render(<StatusBar {...defaultProps} isStreaming={false} />)
      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument()
    })
  })

  describe("error display", () => {
    it("shows error message when error is present", () => {
      render(<StatusBar {...defaultProps} error="WebSocket connection failed" />)
      expect(screen.getByText("WebSocket connection failed")).toBeInTheDocument()
    })

    it("does not show error when error is null", () => {
      render(<StatusBar {...defaultProps} error={null} />)
      expect(screen.queryByText("WebSocket connection failed")).not.toBeInTheDocument()
    })
  })

  describe("token usage", () => {
    it("does not show token usage when both input and output are 0", () => {
      mockUseTokenUsage.mockReturnValue({ input: 0, output: 0 })
      render(<StatusBar {...defaultProps} />)
      expect(screen.queryByText(/in \//)).not.toBeInTheDocument()
    })

    it("shows token usage when input tokens are non-zero", () => {
      mockUseTokenUsage.mockReturnValue({ input: 500, output: 0 })
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByText(/500 in/)).toBeInTheDocument()
    })

    it("shows token usage when output tokens are non-zero", () => {
      mockUseTokenUsage.mockReturnValue({ input: 0, output: 250 })
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByText(/250 out/)).toBeInTheDocument()
    })

    it("shows both input and output token counts", () => {
      mockUseTokenUsage.mockReturnValue({ input: 500, output: 250 })
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByText("500 in / 250 out")).toBeInTheDocument()
    })

    it("formats large token counts with k suffix", () => {
      mockUseTokenUsage.mockReturnValue({ input: 1500, output: 2500 })
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByText("1.5k in / 2.5k out")).toBeInTheDocument()
    })

    it("formats very large token counts with M suffix", () => {
      mockUseTokenUsage.mockReturnValue({ input: 1500000, output: 2500000 })
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByText("1.5M in / 2.5M out")).toBeInTheDocument()
    })
  })

  describe("combined states", () => {
    it("shows all indicators together when streaming with tokens and error", () => {
      mockUseTokenUsage.mockReturnValue({ input: 1000, output: 500 })
      render(<StatusBar {...defaultProps} isStreaming={true} error="Partial failure" />)
      expect(screen.getByText("connected")).toBeInTheDocument()
      expect(screen.getByText("Claude Code")).toBeInTheDocument()
      expect(screen.getByText("Partial failure")).toBeInTheDocument()
      expect(screen.getByText("1.0k in / 500 out")).toBeInTheDocument()
    })
  })
})

/**
 * Tests for the withImportedState Storybook decorator.
 *
 * This tests the core behavior of the decorator:
 * 1. Shows loading state while fetching/importing state
 * 2. Renders the story once state is loaded
 * 3. Shows error state if fetch fails
 * 4. Calls cleanup function on unmount
 *
 * Note: We test by creating a minimal reproduction of the decorator's
 * behavior rather than importing the actual decorator, because the
 * .storybook directory has different module resolution which causes
 * React version conflicts in jsdom tests.
 */
import { render, screen, waitFor, cleanup } from "@/test-utils"
import { useEffect, useState } from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Mock the importState module
const mockImportStateFromUrl = vi.fn()
const mockClearImportedState = vi.fn()

vi.mock("@/lib/importState", () => ({
  importStateFromUrl: (...args: unknown[]) => mockImportStateFromUrl(...args),
  clearImportedState: (...args: unknown[]) => mockClearImportedState(...args),
}))

// Import the mocked functions
import { importStateFromUrl, clearImportedState } from "@/lib/importState"

/**
 * Replica of the withImportedState decorator for testing.
 * This mirrors the exact logic from .storybook/decorators.tsx
 * but lives in src/ to avoid React resolution issues.
 */
type ImportStatus = "loading" | "ready" | "error"

function WithImportedState({
  stateUrl,
  children,
}: {
  stateUrl: string
  children: React.ReactNode
}) {
  const [status, setStatus] = useState<ImportStatus>("loading")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadState() {
      try {
        await importStateFromUrl(stateUrl)
        if (mounted) {
          setStatus("ready")
        }
      } catch (err) {
        if (mounted) {
          setStatus("error")
          setError(err instanceof Error ? err.message : "Failed to load state")
        }
      }
    }

    loadState()

    // Cleanup on unmount
    return () => {
      mounted = false
      clearImportedState().catch(console.error)
    }
  }, [stateUrl])

  if (status === "loading") {
    return (
      <div className="bg-background text-foreground flex h-screen w-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg font-medium">Loading state...</div>
          <div className="text-muted-foreground text-sm">
            Decompressing and importing {stateUrl}
          </div>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="bg-background text-foreground flex h-screen w-screen items-center justify-center">
        <div className="text-center">
          <div className="text-destructive mb-4 text-lg font-medium">Failed to load state</div>
          <div className="text-muted-foreground text-sm">{error}</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Simple test story component
function TestStory() {
  return <div data-testid="story-content">Story Content</div>
}

describe("withImportedState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to successful import
    mockImportStateFromUrl.mockResolvedValue(undefined)
    mockClearImportedState.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  describe("loading state", () => {
    it("shows loading state initially while fetching state", async () => {
      // Make the import hang indefinitely
      mockImportStateFromUrl.mockImplementation(() => new Promise(() => {}))

      render(
        <WithImportedState stateUrl="/fixtures/test-state.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      // Should show loading state
      expect(screen.getByText("Loading state...")).toBeInTheDocument()
      expect(
        screen.getByText("Decompressing and importing /fixtures/test-state.json.gz"),
      ).toBeInTheDocument()

      // Story content should not be visible yet
      expect(screen.queryByTestId("story-content")).not.toBeInTheDocument()
    })

    it("shows the URL of the state file being loaded", async () => {
      mockImportStateFromUrl.mockImplementation(() => new Promise(() => {}))

      const customUrl = "/fixtures/custom-fixture.json.gz"
      render(
        <WithImportedState stateUrl={customUrl}>
          <TestStory />
        </WithImportedState>,
      )

      expect(screen.getByText(`Decompressing and importing ${customUrl}`)).toBeInTheDocument()
    })
  })

  describe("successful state loading", () => {
    it("renders story after state is loaded successfully", async () => {
      mockImportStateFromUrl.mockResolvedValue(undefined)

      render(
        <WithImportedState stateUrl="/fixtures/test-state.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      // Wait for the story to render
      await waitFor(() => {
        expect(screen.getByTestId("story-content")).toBeInTheDocument()
      })

      // Loading state should no longer be visible
      expect(screen.queryByText("Loading state...")).not.toBeInTheDocument()
    })

    it("calls importStateFromUrl with the correct URL", async () => {
      const stateUrl = "/fixtures/test-state.json.gz"
      mockImportStateFromUrl.mockResolvedValue(undefined)

      render(
        <WithImportedState stateUrl={stateUrl}>
          <TestStory />
        </WithImportedState>,
      )

      await waitFor(() => {
        expect(mockImportStateFromUrl).toHaveBeenCalledTimes(1)
        expect(mockImportStateFromUrl).toHaveBeenCalledWith(stateUrl)
      })
    })
  })

  describe("error state", () => {
    it("shows error state when fetch fails", async () => {
      mockImportStateFromUrl.mockRejectedValue(new Error("Network error: 404 Not Found"))

      render(
        <WithImportedState stateUrl="/fixtures/missing-state.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText("Failed to load state")).toBeInTheDocument()
      })

      // Should display the error message
      expect(screen.getByText("Network error: 404 Not Found")).toBeInTheDocument()

      // Story content should not be visible
      expect(screen.queryByTestId("story-content")).not.toBeInTheDocument()
    })

    it("shows generic error message for non-Error exceptions", async () => {
      mockImportStateFromUrl.mockRejectedValue("String error")

      render(
        <WithImportedState stateUrl="/fixtures/test-state.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      await waitFor(() => {
        // Both the title and error message will say "Failed to load state"
        // since non-Error exceptions don't have a .message property
        expect(screen.getAllByText("Failed to load state")).toHaveLength(2)
      })

      // Story content should not be visible
      expect(screen.queryByTestId("story-content")).not.toBeInTheDocument()
    })

    it("shows error when decompression fails", async () => {
      mockImportStateFromUrl.mockRejectedValue(new Error("Invalid gzip data"))

      render(
        <WithImportedState stateUrl="/fixtures/corrupted.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      await waitFor(() => {
        expect(screen.getByText("Failed to load state")).toBeInTheDocument()
        expect(screen.getByText("Invalid gzip data")).toBeInTheDocument()
      })
    })
  })

  describe("cleanup on unmount", () => {
    it("calls clearImportedState when component unmounts", async () => {
      mockImportStateFromUrl.mockResolvedValue(undefined)

      const { unmount } = render(
        <WithImportedState stateUrl="/fixtures/test-state.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      // Wait for story to render
      await waitFor(() => {
        expect(screen.getByTestId("story-content")).toBeInTheDocument()
      })

      // Unmount the component
      unmount()

      // Cleanup should be called
      await waitFor(() => {
        expect(mockClearImportedState).toHaveBeenCalledTimes(1)
      })
    })

    it("calls clearImportedState even when still loading", async () => {
      // Make import hang
      mockImportStateFromUrl.mockImplementation(() => new Promise(() => {}))

      const { unmount } = render(
        <WithImportedState stateUrl="/fixtures/test-state.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      // Should be in loading state
      expect(screen.getByText("Loading state...")).toBeInTheDocument()

      // Unmount while still loading
      unmount()

      // Cleanup should still be called
      await waitFor(() => {
        expect(mockClearImportedState).toHaveBeenCalledTimes(1)
      })
    })

    it("does not update state after unmount (avoids memory leak)", async () => {
      // Create a promise we can control
      let resolveImport: () => void
      const importPromise = new Promise<void>(resolve => {
        resolveImport = resolve
      })
      mockImportStateFromUrl.mockReturnValue(importPromise)

      const { unmount } = render(
        <WithImportedState stateUrl="/fixtures/test-state.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      // Should be in loading state
      expect(screen.getByText("Loading state...")).toBeInTheDocument()

      // Unmount before import completes
      unmount()

      // Now resolve the import after unmount
      resolveImport!()

      // Wait a tick to ensure any state updates would have happened
      await new Promise(resolve => setTimeout(resolve, 10))

      // This test mainly ensures no React warnings about updating unmounted components
      // The key behavior is that the mounted flag prevents setState after unmount
      expect(mockClearImportedState).toHaveBeenCalled()
    })

    it("handles cleanup errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      mockImportStateFromUrl.mockResolvedValue(undefined)
      mockClearImportedState.mockRejectedValue(new Error("Cleanup failed"))

      const { unmount } = render(
        <WithImportedState stateUrl="/fixtures/test-state.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      // Wait for story to render
      await waitFor(() => {
        expect(screen.getByTestId("story-content")).toBeInTheDocument()
      })

      // Unmount - this should not throw even though cleanup fails
      unmount()

      // Wait for the cleanup promise to reject
      await waitFor(() => {
        expect(mockClearImportedState).toHaveBeenCalled()
      })

      // The decorator uses .catch(console.error), so error should be logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled()
      })

      consoleErrorSpy.mockRestore()
    })
  })

  describe("different state URLs", () => {
    it("can be used with different state URLs", async () => {
      mockImportStateFromUrl.mockResolvedValue(undefined)

      // First render with one URL
      const { unmount: unmount1 } = render(
        <WithImportedState stateUrl="/fixtures/state-1.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      await waitFor(() => {
        expect(mockImportStateFromUrl).toHaveBeenCalledWith("/fixtures/state-1.json.gz")
      })

      unmount1()

      // Reset mock to track new calls
      mockImportStateFromUrl.mockClear()

      // Second render with different URL
      render(
        <WithImportedState stateUrl="/fixtures/state-2.json.gz">
          <TestStory />
        </WithImportedState>,
      )

      await waitFor(() => {
        expect(mockImportStateFromUrl).toHaveBeenCalledWith("/fixtures/state-2.json.gz")
      })
    })
  })
})

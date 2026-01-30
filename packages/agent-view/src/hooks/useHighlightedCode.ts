import { useEffect, useState } from "react"
import { useAgentViewContext } from "../context/useAgentViewContext"

/**
 * Hook to syntax-highlight code content using the current theme.
 * Returns the highlighted HTML string ready for rendering.
 *
 * Currently returns unhighlighted content. Full theme support
 * will be provided by @herbcaudill/agent-view-theme.
 */
export function useHighlightedCode(
  /** The code content to highlight */
  content: string,
  /** The programming language for syntax highlighting */
  _language: string,
): string {
  // Stub: return empty string to indicate no highlighting available.
  // The HighlightedLine component falls back to plain text when html is empty.
  return ""
}

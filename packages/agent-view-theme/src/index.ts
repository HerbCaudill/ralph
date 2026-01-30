/**
 * Stub exports for @herbcaudill/agent-view-theme.
 * Full implementation will be provided in a future task (r-79d25.4).
 */

/** Options for the highlight function. */
export interface HighlightOptions {
  isDark?: boolean
}

/**
 * Highlight code with syntax coloring.
 * Stub implementation that returns a plain pre/code block.
 */
export async function highlight(
  /** The code to highlight */
  code: string,
  /** The language for syntax highlighting */
  _language: string,
  /** Options for highlighting */
  _options?: HighlightOptions,
): Promise<string> {
  return `<pre><code>${escapeHtml(code)}</code></pre>`
}

/**
 * Normalize a language identifier to a standard form.
 * Stub implementation that passes through the input.
 */
export function normalizeLanguage(
  /** The language identifier to normalize */
  language: string,
): string {
  return language
}

/** Escape HTML special characters to prevent XSS. */
function escapeHtml(
  /** The text to escape */
  text: string,
): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

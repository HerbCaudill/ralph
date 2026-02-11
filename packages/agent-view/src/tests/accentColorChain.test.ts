import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Verifies that the CSS variable chain for accent colors is correctly wired so that
 * `bg-accent` resolves through `--color-accent` → `--accent` → `--repo-accent`,
 * which is dynamically set by `useAccentColor`.
 *
 * Without this chain, `bg-accent` falls back to a static color instead of the
 * workspace's dynamic accent color.
 */
describe("accent color CSS variable chain", () => {
  const css = readFileSync(resolve(__dirname, "../styles.css"), "utf-8")

  it("wires --accent to --repo-accent in :root", () => {
    const rootBlock = extractBlock(css, ":root")
    expect(rootBlock).toContain("--accent: var(--repo-accent)")
  })

  it("wires --accent-foreground to --repo-accent-foreground in :root", () => {
    const rootBlock = extractBlock(css, ":root")
    expect(rootBlock).toContain("--accent-foreground: var(--repo-accent-foreground)")
  })

  it("wires --accent to --repo-accent in .dark", () => {
    const darkBlock = extractBlock(css, ".dark")
    expect(darkBlock).toContain("--accent: var(--repo-accent)")
  })

  it("wires --accent-foreground to --repo-accent-foreground in .dark", () => {
    const darkBlock = extractBlock(css, ".dark")
    expect(darkBlock).toContain("--accent-foreground: var(--repo-accent-foreground)")
  })

  it("defines --color-accent in @theme inline referencing --accent", () => {
    const themeBlock = extractBlock(css, "@theme inline")
    expect(themeBlock).toContain("--color-accent: var(--accent)")
  })

  it("defines --color-repo-accent with fallback to --primary", () => {
    const themeBlock = extractBlock(css, "@theme inline")
    expect(themeBlock).toContain("--color-repo-accent: var(--repo-accent, var(--primary))")
  })
})

/** Extract the content of a CSS block by its selector/at-rule. */
function extractBlock(
  /** The full CSS string */
  css: string,
  /** The selector or at-rule to find (e.g., ":root", ".dark", "@theme inline") */
  selector: string,
): string {
  // Find the selector followed by optional whitespace and an opening brace
  const pattern = new RegExp(escapeRegExp(selector) + "\\s*\\{")
  const match = pattern.exec(css)
  if (!match) return ""

  const braceStart = css.indexOf("{", match.index + selector.length)
  if (braceStart === -1) return ""

  let depth = 1
  let i = braceStart + 1
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth++
    if (css[i] === "}") depth--
    i++
  }
  return css.slice(braceStart + 1, i - 1)
}

/** Escape special regex characters in a string. */
function escapeRegExp(
  /** The string to escape */
  s: string,
): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

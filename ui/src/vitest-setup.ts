import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// Suppress React act() warnings (mostly from Radix UI internals)
const originalError = console.error
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) return
  originalError(...args)
}

// Mock matchMedia for tests that use useTheme
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)",
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock ResizeObserver for tests that use cmdk/command palette
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
})

// Mock scrollIntoView for tests that use cmdk/command palette
Element.prototype.scrollIntoView = () => {}

// Mock MDXEditor to prevent jsdom CSS parsing errors with stitches
vi.mock("@mdxeditor/editor", () => ({
  MDXEditor: ({
    markdown,
    onChange,
    onBlur,
    placeholder,
    readOnly,
    autoFocus,
  }: {
    markdown: string
    onChange?: (value: string) => void
    onBlur?: () => void
    placeholder?: string
    readOnly?: boolean
    autoFocus?: boolean
  }) => {
    const React = require("react")
    return React.createElement("textarea", {
      value: markdown,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
      onBlur,
      placeholder,
      readOnly,
      autoFocus,
      "data-testid": "mdx-editor-mock",
    })
  },
  headingsPlugin: () => ({}),
  listsPlugin: () => ({}),
  quotePlugin: () => ({}),
  thematicBreakPlugin: () => ({}),
  markdownShortcutPlugin: () => ({}),
  linkPlugin: () => ({}),
  linkDialogPlugin: () => ({}),
  toolbarPlugin: () => ({}),
  BoldItalicUnderlineToggles: () => null,
  ListsToggle: () => null,
  BlockTypeSelect: () => null,
  CreateLink: () => null,
}))

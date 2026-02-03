import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Cleanup after each test to prevent DOM leakage between tests
afterEach(() => {
  cleanup()
})

// Mock localStorage for tests - Node 24's built-in localStorage conflicts with jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
})

// Mock matchMedia for tests that use theme detection
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

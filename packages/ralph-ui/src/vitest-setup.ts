import "@testing-library/jest-dom/vitest"

// Skip browser-specific setup when running in Node environment (server tests)
if (typeof window === "undefined") {
  // Node environment: nothing to mock
} else {
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

  // Mock ResizeObserver for layout components
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  })

  // Mock scrollIntoView for tests
  Element.prototype.scrollIntoView = () => {}

  if (typeof HTMLDialogElement !== "undefined") {
    if (!HTMLDialogElement.prototype.showModal) {
      Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
        configurable: true,
        value: Element.prototype.scrollIntoView,
      })
    }

    if (!HTMLDialogElement.prototype.close) {
      Object.defineProperty(HTMLDialogElement.prototype, "close", {
        configurable: true,
        value: Element.prototype.scrollIntoView,
      })
    }
  }
} // end if (typeof window !== "undefined")

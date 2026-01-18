import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { existsSync, readFileSync } from "fs"

// Note: Full integration testing of IterationRunner would require:
// 1. Mocking child_process.spawn to simulate Claude CLI
// 2. Mocking file system operations
// 3. Testing React component rendering with ink-testing-library
//
// These tests focus on the getPromptContent logic which is the
// most testable pure function in the module.

// We'll test the logic by importing and mocking fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

describe("IterationRunner prompt content", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Import the function after mocking fs
  const getGetPromptContent = async () => {
    // Reset module cache to get fresh import with mocks
    vi.resetModules()
    const module = await import("./IterationRunner.js")
    return module.getPromptContent
  }

  it("returns content from .ralph/prompt.md when it exists", async () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>

    mockExistsSync.mockImplementation((path: string) => {
      return path.includes(".ralph/prompt.md") || path.includes(".ralph\\prompt.md")
    })
    mockReadFileSync.mockReturnValue("Custom prompt content")

    const getPromptContent = await getGetPromptContent()
    const content = getPromptContent()

    expect(content).toBe("Custom prompt content")
  })

  it("falls back to prompt-beads.md when .beads directory exists", async () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>

    mockExistsSync.mockImplementation((path: string) => {
      // .ralph/prompt.md doesn't exist
      if (path.includes("prompt.md") && path.includes(".ralph")) return false
      // .beads directory exists
      if (path.includes(".beads")) return true
      // Template file exists
      if (path.includes("prompt-beads.md")) return true
      return false
    })
    mockReadFileSync.mockReturnValue("Beads template content")

    const getPromptContent = await getGetPromptContent()
    const content = getPromptContent()

    expect(content).toBe("Beads template content")
  })

  it("falls back to prompt.md template when .ralph/todo.md exists", async () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>

    mockExistsSync.mockImplementation((path: string) => {
      // .ralph/prompt.md doesn't exist
      if (path.includes("prompt.md") && path.includes(".ralph")) return false
      // .beads directory doesn't exist
      if (path.includes(".beads")) return false
      // .ralph/todo.md exists
      if (path.includes("todo.md") && path.includes(".ralph")) return true
      // Template files exist
      if (path.includes("templates") && path.includes("prompt.md")) return true
      return false
    })
    mockReadFileSync.mockReturnValue("Todo template content")

    const getPromptContent = await getGetPromptContent()
    const content = getPromptContent()

    expect(content).toBe("Todo template content")
  })
})

// Note: For comprehensive integration tests, you would want to:
//
// 1. Test child process spawning:
//    - Mock spawn() to return a fake ChildProcess
//    - Emit data events to simulate Claude output
//    - Test JSON parsing of events
//    - Test COMPLETE promise detection
//    - Test exit code handling
//
// 2. Test file operations:
//    - Mock appendFileSync/writeFileSync
//    - Verify events are logged correctly
//    - Test log file creation
//
// 3. Test React rendering:
//    - Use ink-testing-library to render component
//    - Test initialization prompts
//    - Test error display
//    - Test iteration counter
//
// Example structure for a full integration test:
//
// import { render } from 'ink-testing-library'
// import { EventEmitter } from 'events'
//
// vi.mock('child_process', () => ({
//   spawn: vi.fn(() => {
//     const mockProcess = new EventEmitter()
//     mockProcess.stdout = new EventEmitter()
//     mockProcess.kill = vi.fn()
//     return mockProcess
//   })
// }))
//
// it('parses streaming JSON events', () => {
//   const { lastFrame } = render(<IterationRunner totalIterations={1} />)
//   const mockChild = getLastSpawnedProcess()
//
//   mockChild.stdout.emit('data', Buffer.from('{"type":"assistant"}\n'))
//
//   expect(lastFrame()).toContain('expected output')
// })

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

  it("combines core-prompt.md with custom workflow.md when it exists", async () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>

    mockExistsSync.mockImplementation((path: string) => {
      // Core prompt always exists in templates
      if (path.includes("core-prompt.md")) return true
      // Custom workflow exists
      if (path.includes(".ralph") && path.includes("workflow.md")) return true
      return false
    })

    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("core-prompt.md")) {
        return "# Core\n\n{WORKFLOW}"
      }
      if (path.includes("workflow.md")) {
        return "Custom workflow content"
      }
      return ""
    })

    const getPromptContent = await getGetPromptContent()
    const content = getPromptContent()

    expect(content).toBe("# Core\n\nCustom workflow content")
  })

  it("falls back to default workflow.md when no custom workflow exists", async () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>

    mockExistsSync.mockImplementation((path: string) => {
      // Core prompt always exists in templates
      if (path.includes("core-prompt.md")) return true
      // Custom workflow doesn't exist
      if (path.includes(".ralph") && path.includes("workflow.md")) return false
      // Default workflow exists in templates
      if (path.includes("templates") && path.includes("workflow.md")) return true
      return false
    })

    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("core-prompt.md")) {
        return "# Core\n\n{WORKFLOW}"
      }
      if (path.includes("templates") && path.includes("workflow.md")) {
        return "Default workflow content"
      }
      return ""
    })

    const getPromptContent = await getGetPromptContent()
    const content = getPromptContent()

    expect(content).toBe("# Core\n\nDefault workflow content")
  })

  it("returns minimal prompt when templates are missing", async () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>

    mockExistsSync.mockReturnValue(false)

    const getPromptContent = await getGetPromptContent()
    const content = getPromptContent()

    expect(content).toBe("Work on the highest-priority task.")
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

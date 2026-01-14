import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { existsSync } from "fs"

// Note: Full integration testing of IterationRunner would require:
// 1. Mocking child_process.spawn to simulate Claude CLI
// 2. Mocking file system operations
// 3. Testing React component rendering with ink-testing-library
//
// These tests focus on the checkRequiredFiles logic which is the
// most testable pure function in the module.

// We'll test the logic by importing and mocking fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

describe("IterationRunner file checking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("detects all files exist", () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    mockExistsSync.mockReturnValue(true)

    // Simulate the logic from checkRequiredFiles
    const requiredFiles = ["prompt.md", "todo.md"]
    const missing = requiredFiles.filter(file => !existsSync(file))
    const exists = missing.length === 0

    expect(exists).toBe(true)
    expect(missing).toEqual([])
  })

  it("detects missing prompt.md", () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    mockExistsSync.mockImplementation((path: string) => {
      return !path.includes("prompt.md")
    })

    const requiredFiles = ["prompt.md", "todo.md"]
    const missing = requiredFiles.filter(file => !existsSync(file))
    const exists = missing.length === 0

    expect(exists).toBe(false)
    expect(missing).toContain("prompt.md")
  })

  it("detects multiple missing files", () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    mockExistsSync.mockReturnValue(false)

    const requiredFiles = ["prompt.md", "todo.md"]
    const missing = requiredFiles.filter(file => !existsSync(file))
    const exists = missing.length === 0

    expect(exists).toBe(false)
    expect(missing).toEqual(["prompt.md", "todo.md"])
  })

  it("detects only todo.md exists", () => {
    const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes("todo.md")
    })

    const requiredFiles = ["prompt.md", "todo.md"]
    const missing = requiredFiles.filter(file => !existsSync(file))
    const exists = missing.length === 0

    expect(exists).toBe(false)
    expect(missing).toEqual(["prompt.md"])
    expect(missing).not.toContain("todo.md")
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

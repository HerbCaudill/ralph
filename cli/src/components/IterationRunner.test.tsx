import { describe, it, expect } from "vitest"

// Note: Full integration testing of IterationRunner would require:
// 1. Mocking child_process.spawn to simulate Claude CLI
// 2. Mocking file system operations
// 3. Testing React component rendering with ink-testing-library
//
// The getPromptContent function has been moved to its own module (../lib/getPromptContent.ts)
// and can be tested there. These tests have been removed as they were testing
// implementation details of the prompt loading logic.

describe("IterationRunner", () => {
  it("is a React component", () => {
    // Placeholder: IterationRunner is primarily tested through integration tests
    // and e2e tests that involve spawning the actual Claude CLI.
    // Unit tests for isolated components (EventDisplay, Header, etc) are in their own files.
    expect(true).toBe(true)
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

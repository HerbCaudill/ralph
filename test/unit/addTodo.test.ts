import { describe, it, expect } from "vitest"
import { insertTodo } from "../../src/lib/addTodo.js"

describe("insertTodo", () => {
  it("inserts todo after 'To do' header", () => {
    const content = `### To do

- [ ] Existing task

### Done

- [x] Completed task`

    const result = insertTodo(content, "New task")

    expect(result).toBe(`### To do

- [ ] New task
- [ ] Existing task

### Done

- [x] Completed task`)
  })

  it("handles '## To do' header format", () => {
    const content = `## To do

- [ ] Existing task`

    const result = insertTodo(content, "New task")

    expect(result).toBe(`## To do

- [ ] New task
- [ ] Existing task`)
  })

  it("handles 'To Do' with different casing", () => {
    const content = `### To Do

- [ ] Existing task`

    const result = insertTodo(content, "New task")

    expect(result).toBe(`### To Do

- [ ] New task
- [ ] Existing task`)
  })

  it("handles empty todo section", () => {
    const content = `### To do

### Done

- [x] Completed task`

    const result = insertTodo(content, "New task")

    expect(result).toBe(`### To do

- [ ] New task
### Done

- [x] Completed task`)
  })

  it("creates To do section if none exists", () => {
    const content = `### Done

- [x] Completed task`

    const result = insertTodo(content, "New task")

    expect(result).toBe(`### To do

- [ ] New task

### Done

- [x] Completed task`)
  })

  it("handles completely empty file", () => {
    const content = ""

    const result = insertTodo(content, "New task")

    expect(result).toBe(`### To do

- [ ] New task

`)
  })

  it("preserves multiple existing todos", () => {
    const content = `### To do

- [ ] First task
- [ ] Second task
- [ ] Third task

### Done`

    const result = insertTodo(content, "New task")

    expect(result).toBe(`### To do

- [ ] New task
- [ ] First task
- [ ] Second task
- [ ] Third task

### Done`)
  })
})

/**
 * Inserts a todo item into the content, right after the "To do" header.
 */
export const insertTodo = (
  /** The current content of the todo file */
  content: string,
  /** The description of the todo item to insert */
  description: string,
): string => {
  const lines = content.split("\n")
  const todoHeaderIndex = lines.findIndex(line => /^###?\s*To\s*do/i.test(line))

  if (todoHeaderIndex === -1) {
    // No "To do" section found, add one at the beginning
    return `### To do\n\n- [ ] ${description}\n\n${content}`
  }

  // Find the first line after the header (skip empty lines)
  let insertIndex = todoHeaderIndex + 1
  while (insertIndex < lines.length && lines[insertIndex].trim() === "") {
    insertIndex++
  }

  // Insert the new todo item
  lines.splice(insertIndex, 0, `- [ ] ${description}`)

  return lines.join("\n")
}

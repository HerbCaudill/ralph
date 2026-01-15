import { execSync } from "child_process"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

/**
 * Adds a todo item to the todo.md file and commits just that line.
 * Inserts the todo into the working directory, stages only that line, and commits.
 */
export const addTodo = (description: string, cwd: string = process.cwd()): void => {
  const todoPath = join(cwd, ".ralph", "todo.md")

  // Read current working directory file and insert the new todo
  const content = readFileSync(todoPath, "utf-8")
  const newContent = insertTodo(content, description)

  // Write updated content to working directory
  writeFileSync(todoPath, newContent)

  // Get what's currently in the index for this file (or HEAD if not staged)
  const indexContent = execSync(
    "git show :0:.ralph/todo.md 2>/dev/null || git show HEAD:.ralph/todo.md",
    {
      cwd,
      encoding: "utf-8",
    },
  )

  // Create a blob with just the todo added to the index version
  const indexWithTodo = insertTodo(indexContent, description)
  const blobHash = execSync("git hash-object -w --stdin", {
    cwd,
    encoding: "utf-8",
    input: indexWithTodo,
  }).trim()

  // Stage just our change by updating the index to this blob
  execSync(`git update-index --cacheinfo 100644,${blobHash},.ralph/todo.md`, {
    cwd,
    stdio: "pipe",
  })

  // Commit just the staged change - escape double quotes and backslashes in description
  const escapedDescription = description.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  execSync(`git commit -m "todo: ${escapedDescription}"`, { cwd, stdio: "pipe" })

  console.log(`✅ added`)
}

/**
 * Inserts a todo item into the content, right after the "To do" header.
 */
export const insertTodo = (content: string, description: string): string => {
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

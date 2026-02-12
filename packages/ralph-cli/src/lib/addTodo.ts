import { execSync } from "child_process"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { insertTodo } from "./insertTodo.js"

/**
 * Adds a todo item to the todo.md file and commits just that line.
 * Inserts the todo into the working directory, stages only that line, and commits.
 * Creates the file if it doesn't exist.
 */
export const addTodo = (
  /** The description of the todo item to add */
  description: string,
  /** The working directory to use (defaults to current directory) */
  cwd: string = process.cwd(),
): void => {
  const todoPath = join(cwd, ".ralph", "todo.md")

  // Read current working directory file (or empty string if it doesn't exist) and insert the new todo
  const content = existsSync(todoPath) ? readFileSync(todoPath, "utf-8") : ""
  const newContent = insertTodo(content, description)

  // Write updated content to working directory
  writeFileSync(todoPath, newContent)

  // Get what's currently in the index for this file (or HEAD if not staged, or empty if new)
  let indexContent = ""
  try {
    indexContent = execSync(
      "git show :0:.ralph/todo.md 2>/dev/null || git show HEAD:.ralph/todo.md 2>/dev/null || echo ''",
      {
        cwd,
        encoding: "utf-8",
      },
    )
  } catch {
    // File doesn't exist in git yet, use empty string
    indexContent = ""
  }

  // Create a blob with just the todo added to the index version
  const indexWithTodo = insertTodo(indexContent, description)
  const blobHash = execSync("git hash-object -w --stdin", {
    cwd,
    encoding: "utf-8",
    input: indexWithTodo,
  }).trim()

  // Stage just our change by updating the index to this blob
  // Use --add flag to handle new files
  execSync(`git update-index --add --cacheinfo 100644,${blobHash},.ralph/todo.md`, {
    cwd,
    stdio: "pipe",
  })

  // Commit just the staged change - escape double quotes and backslashes in description
  const escapedDescription = description.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  execSync(`git commit -m "todo: ${escapedDescription}"`, { cwd, stdio: "pipe" })

  console.log(`✅ added`)
}

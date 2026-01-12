import { execSync } from "child_process"
import { execOptions } from "./types.js"

/**
 * Use Claude to resolve merge conflicts
 * Returns true if conflicts were resolved successfully, false otherwise
 */
export function resolveConflicts(repoRoot: string): boolean {
  try {
    // Check if there are actually conflicts
    const status = execSync("git status --porcelain", {
      ...execOptions,
      cwd: repoRoot,
    }).toString()

    // Look for unmerged files (prefixed with U or having UU status)
    const hasConflicts = status.split("\n").some(line => {
      const statusCode = line.slice(0, 2)
      return statusCode.includes("U") || statusCode === "AA" || statusCode === "DD"
    })

    if (!hasConflicts) {
      return true // No conflicts to resolve
    }

    // Get list of conflicted files
    const conflictedFiles = execSync("git diff --name-only --diff-filter=U", {
      ...execOptions,
      cwd: repoRoot,
    })
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean)

    if (conflictedFiles.length === 0) {
      return true
    }

    // Use Claude to resolve conflicts
    const fileArgs = conflictedFiles.map(f => `@${f}`).join(" ")
    const prompt = `There are merge conflicts in the following files that need to be resolved:

${conflictedFiles.map(f => `- ${f}`).join("\n")}

Please resolve the merge conflicts by:
1. Reading each conflicted file
2. Understanding both versions (between <<<<<<< and ======= is the current branch, between ======= and >>>>>>> is the incoming branch)
3. Choosing the correct resolution or combining both changes as appropriate
4. Removing the conflict markers (<<<<<<, =======, >>>>>>>)
5. Saving the resolved file

After resolving all conflicts, stage the files with git add.`

    execSync(`claude --permission-mode bypassPermissions -p "${prompt}" ${fileArgs}`, {
      cwd: repoRoot,
      stdio: "inherit",
    })

    // Check if conflicts are resolved (no more unmerged files)
    const statusAfter = execSync("git status --porcelain", {
      ...execOptions,
      cwd: repoRoot,
    }).toString()

    const stillHasConflicts = statusAfter.split("\n").some(line => {
      const statusCode = line.slice(0, 2)
      return statusCode.includes("U") || statusCode === "AA" || statusCode === "DD"
    })

    if (stillHasConflicts) {
      return false
    }

    // Complete the merge
    execSync("git commit --no-edit", {
      ...execOptions,
      cwd: repoRoot,
    })

    return true
  } catch (error) {
    console.error(`Failed to resolve conflicts: ${error}`)
    return false
  }
}

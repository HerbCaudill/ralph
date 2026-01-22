import { existsSync, mkdirSync, copyFileSync } from "fs"
import { join, dirname } from "path"

/**
 * Copy files from templates to destination, creating directories as needed.
 */
export function copyTemplates(
  /** Directory containing template files */
  templatesDir: string,
  /** Destination directory for copied files */
  destDir: string,
  /** Array of source and destination path pairs */
  files: Array<{ src: string; dest: string }>,
): CopyResult {
  const result: CopyResult = { created: [], skipped: [], errors: [] }

  for (const { src, dest } of files) {
    const srcPath = join(templatesDir, src)
    const destPath = join(destDir, dest)

    const destDirPath = dirname(destPath)
    if (!existsSync(destDirPath)) {
      mkdirSync(destDirPath, { recursive: true })
    }

    if (existsSync(destPath)) {
      result.skipped.push(dest)
    } else if (existsSync(srcPath)) {
      copyFileSync(srcPath, destPath)
      result.created.push(dest)
    } else {
      result.errors.push(`Template not found: ${src}`)
    }
  }

  return result
}

/**
 * Result of copying template files.
 */
interface CopyResult {
  /** Files successfully created */
  created: string[]
  /** Files that already existed and were skipped */
  skipped: string[]
  /** Error messages for files that could not be copied */
  errors: string[]
}

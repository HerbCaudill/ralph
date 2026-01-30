import type { DiffLine } from "@/types"

/**  Parse the differences between two strings and return structured diff lines. */
export function parseDiff(
  /** The original string */
  oldString: string,
  /** The modified string */
  newString: string,
): DiffLine[] {
  const oldLines = oldString.split("\n")
  const newLines = newString.split("\n")
  const result: DiffLine[] = []

  let oldIdx = 0
  let newIdx = 0

  while (
    oldIdx < oldLines.length &&
    newIdx < newLines.length &&
    oldLines[oldIdx] === newLines[newIdx]
  ) {
    oldIdx++
    newIdx++
  }

  const contextStart = Math.max(0, oldIdx - 1)
  for (let i = contextStart; i < oldIdx; i++) {
    result.push({ type: "context", lineOld: i + 1, lineNew: i + 1, content: oldLines[i] })
  }

  let oldEnd = oldLines.length - 1
  let newEnd = newLines.length - 1
  while (oldEnd > oldIdx && newEnd > newIdx && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--
    newEnd--
  }

  for (let i = oldIdx; i <= oldEnd; i++) {
    result.push({ type: "removed", lineOld: i + 1, content: oldLines[i] })
  }

  for (let i = newIdx; i <= newEnd; i++) {
    result.push({ type: "added", lineNew: i + 1, content: newLines[i] })
  }

  const contextEnd = Math.min(oldLines.length - 1, oldEnd + 2)
  for (let i = oldEnd + 1; i <= contextEnd; i++) {
    const newLineNum = i - oldEnd + newEnd
    if (i < oldLines.length && newLineNum < newLines.length) {
      result.push({
        type: "context",
        lineOld: i + 1,
        lineNew: newLineNum + 1,
        content: oldLines[i],
      })
    }
  }

  return result
}

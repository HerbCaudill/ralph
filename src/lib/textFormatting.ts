import chalk from "chalk"

const termWidth = process.stdout.columns || 80

// Word wrap state for streaming text
let currentLineLength = 0
let lineBuffer = ""
let inBold = false
let inCode = false

const formatSegment = (text: string, bold: boolean, code: boolean) => {
  if (code) return chalk.yellow(text)
  if (bold) return chalk.bold(text)
  return text
}

export const flushLine = () => {
  if (!lineBuffer) return

  let output = ""
  let segment = ""
  let segmentBold = inBold
  let segmentCode = inCode
  let i = 0

  while (i < lineBuffer.length) {
    if (lineBuffer[i] === "*" && lineBuffer[i + 1] === "*") {
      // Flush current segment
      if (segment) {
        output += formatSegment(segment, segmentBold, segmentCode)
        segment = ""
      }
      inBold = !inBold
      segmentBold = inBold
      i += 2
    } else if (lineBuffer[i] === "`") {
      // Flush current segment
      if (segment) {
        output += formatSegment(segment, segmentBold, segmentCode)
        segment = ""
      }
      inCode = !inCode
      segmentCode = inCode
      i++
    } else {
      segment += lineBuffer[i]
      currentLineLength++
      i++
    }
  }
  // Flush remaining segment
  if (segment) {
    output += formatSegment(segment, segmentBold, segmentCode)
  }
  process.stdout.write(output)
  lineBuffer = ""
}

export const writeWrappedText = (text: string) => {
  // Accumulate text, wrap at word boundaries
  for (const char of text) {
    if (char === "\n") {
      flushLine()
      process.stdout.write("\n")
      currentLineLength = 0
    } else if (char === " " || char === "\t") {
      lineBuffer += char
      // Check if we need to wrap - look for last space to break at
      const visibleLength = lineBuffer.replace(/\*\*/g, "").replace(/`/g, "").length
      if (currentLineLength + visibleLength > termWidth) {
        // Find last space to break at
        const lastSpace = lineBuffer.lastIndexOf(" ", lineBuffer.length - 2)
        if (lastSpace > 0) {
          const beforeBreak = lineBuffer.slice(0, lastSpace)
          const afterBreak = lineBuffer.slice(lastSpace + 1)
          lineBuffer = beforeBreak
          flushLine()
          process.stdout.write("\n")
          currentLineLength = 0
          lineBuffer = afterBreak
        }
      }
    } else {
      lineBuffer += char
    }
  }
}

export const resetTextState = () => {
  currentLineLength = 0
  lineBuffer = ""
  inBold = false
  inCode = false
}

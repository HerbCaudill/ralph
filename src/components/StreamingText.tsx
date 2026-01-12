import React from "react"
import { Text } from "ink"

export const StreamingText = ({ content }: Props) => {
  // Process markdown formatting: **bold** and `code`
  const parts: Array<{ text: string; bold?: boolean; code?: boolean }> = []
  let i = 0
  let currentText = ""
  let inBold = false
  let inCode = false

  while (i < content.length) {
    if (content[i] === "*" && content[i + 1] === "*") {
      // Flush current text
      if (currentText) {
        parts.push({ text: currentText, bold: inBold, code: inCode })
        currentText = ""
      }
      inBold = !inBold
      i += 2
    } else if (content[i] === "`") {
      // Flush current text
      if (currentText) {
        parts.push({ text: currentText, bold: inBold, code: inCode })
        currentText = ""
      }
      inCode = !inCode
      i++
    } else {
      currentText += content[i]
      i++
    }
  }

  // Flush remaining text
  if (currentText) {
    parts.push({ text: currentText, bold: inBold, code: inCode })
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.code) {
          return (
            <Text key={i} color="yellow">
              {part.text}
            </Text>
          )
        }
        if (part.bold) {
          return (
            <Text key={i} bold>
              {part.text}
            </Text>
          )
        }
        return <Text key={i}>{part.text}</Text>
      })}
    </>
  )
}

type Props = {
  content: string
}

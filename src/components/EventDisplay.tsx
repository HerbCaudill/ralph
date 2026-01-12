import React, { useState, useEffect } from "react"
import { Box } from "ink"
import { StreamingText } from "./StreamingText.js"
import { ToolUse } from "./ToolUse.js"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"

export const EventDisplay = ({ events }: Props) => {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])

  useEffect(() => {
    const blocks = events.flatMap(event => eventToBlocks(event))
    setContentBlocks(blocks)
  }, [events])

  return (
    <Box flexDirection="column">
      {contentBlocks.map((block, i) => {
        const prevBlock = i > 0 ? contentBlocks[i - 1] : null
        const needsTopMargin = block.type === "tool" && prevBlock?.type === "text"
        const needsBottomMargin =
          block.type === "tool" &&
          (i === contentBlocks.length - 1 || contentBlocks[i + 1]?.type === "text")

        return block.type === "text" ?
            <StreamingText key={i} content={block.content} />
          : <Box
              key={i}
              marginTop={needsTopMargin ? 1 : 0}
              marginBottom={needsBottomMargin ? 1 : 0}
            >
              <ToolUse name={block.name} arg={block.arg} />
            </Box>
      })}
    </Box>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
}

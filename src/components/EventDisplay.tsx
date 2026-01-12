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
    <Box flexDirection="column" gap={1}>
      {contentBlocks.map((block, i) =>
        block.type === "text" ?
          <StreamingText key={i} content={block.content} />
        : <ToolUse key={i} name={block.name} arg={block.arg} />,
      )}
    </Box>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
}

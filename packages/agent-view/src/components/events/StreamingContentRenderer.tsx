import { StreamingBlockRenderer } from "./StreamingBlockRenderer"
import type { StreamingMessage } from "../../types"

/**
 * Renders all content blocks from a streaming message.
 * Maps each block to a StreamingBlockRenderer for individual rendering.
 */
export function StreamingContentRenderer({ message }: Props) {
  return (
    <>
      {message.contentBlocks.map((block, index) => (
        <StreamingBlockRenderer key={index} block={block} timestamp={message.timestamp} />
      ))}
    </>
  )
}

type Props = {
  message: StreamingMessage
}

import { StreamingBlockRenderer } from "./StreamingBlockRenderer"
import type { StreamingMessage } from "@/types"

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

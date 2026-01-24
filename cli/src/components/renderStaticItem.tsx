import React from "react"
import { Box, Text } from "ink"
import BigText from "ink-big-text"
import Gradient from "ink-gradient"
import { Header } from "./Header.js"
import { formatContentBlock } from "../lib/formatContentBlock.js"
import { type StaticItem } from "./IterationRunner.types.js"

/**  Render a static item (header, iteration header, or content block). */
export const renderStaticItem = (
  /** The static item to render */
  item: StaticItem,
): React.ReactNode => {
  if (item.type === "header") {
    return <Header claudeVersion={item.claudeVersion} ralphVersion={item.ralphVersion} />
  }
  if (item.type === "iteration") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Gradient colors={["#30A6E4", "#EBC635"]}>
          <BigText text={`R${item.iteration}`} font="tiny" />
        </Gradient>
      </Box>
    )
  }
  // Content block
  const lines = formatContentBlock(item.block)
  return (
    <Box flexDirection="column" marginBottom={1}>
      {lines.map((line, i) => (
        <Text key={i}>{line || " "}</Text>
      ))}
    </Box>
  )
}

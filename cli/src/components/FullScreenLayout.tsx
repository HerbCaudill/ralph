import React, { ReactNode } from "react"
import { Box, Text } from "ink"
import BigText from "ink-big-text"
import Gradient from "ink-gradient"
import { useTerminalSize } from "../lib/useTerminalSize.js"
import { useContentHeight, HEADER_HEIGHT, FOOTER_HEIGHT } from "./useContentHeight.js"

/**
 * Full-screen layout component with header, content area, and optional footer
 */
export const FullScreenLayout = ({ title, children, footer, version }: Props) => {
  const { columns, rows } = useTerminalSize()
  const contentHeight = useContentHeight(!!footer)

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
      borderStyle="round"
      borderColor="gray"
    >
      {/* Header section */}
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height={HEADER_HEIGHT}
        borderStyle="single"
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        borderColor="gray"
      >
        <Gradient colors={["#30A6E4", "#EBC635"]}>
          <BigText text={title} font="tiny" />
        </Gradient>
      </Box>

      {/* Content section */}
      <Box
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
        height={contentHeight}
        overflowY="hidden"
      >
        {children}
      </Box>

      {/* Footer section */}
      {footer && (
        <Box
          paddingX={1}
          height={FOOTER_HEIGHT}
          borderStyle="single"
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor="gray"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>{footer}</Box>
          {version && <Text dimColor>{version}</Text>}
        </Box>
      )}
    </Box>
  )
}

type Props = {
  /** Title text displayed in the header */
  title: string
  /** Content to render in the main area */
  children: ReactNode
  /** Optional footer content */
  footer?: ReactNode
  /** Optional version string displayed in the footer */
  version?: string
}

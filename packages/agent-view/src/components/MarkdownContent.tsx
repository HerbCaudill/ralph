import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cx } from "../lib/utils"
import { TextWithLinks } from "./TextWithLinks"
import { CodeBlock } from "./code-block"
import { useAgentViewContext } from "../context/useAgentViewContext"
import type { Components } from "react-markdown"
import type { ReactNode } from "react"

export interface MarkdownContentProps {
  /** The markdown content to render */
  children: string
  /** Optional className for the container */
  className?: string
  /** Whether to include code block syntax highlighting (default: true) */
  withCodeBlocks?: boolean
  /** Size variant for typography (default: "sm") */
  size?: "sm" | "base"
}

/** Process children and replace text nodes with links. */
function processChildren(
  /** The child element to process */
  children: ReactNode,
): ReactNode {
  if (typeof children === "string") {
    return <TextWithLinks>{children}</TextWithLinks>
  }
  return children
}

/** Create markdown components with link support and code blocks. */
function createMarkdownComponents(
  /** Whether to use dark theme */
  isDark: boolean,
  /** Whether to render code blocks with syntax highlighting */
  withCodeBlocks: boolean,
): Components {
  return {
    p(props) {
      const { children, ...rest } = props
      return <p {...rest}>{processChildren(children)}</p>
    },
    li(props) {
      const { children, ...rest } = props
      return <li {...rest}>{processChildren(children)}</li>
    },
    strong(props) {
      const { children, ...rest } = props
      return <strong {...rest}>{processChildren(children)}</strong>
    },
    em(props) {
      const { children, ...rest } = props
      return <em {...rest}>{processChildren(children)}</em>
    },
    code(props) {
      const { children, className: codeClassName, ...rest } = props
      return (
        <code className={codeClassName} {...rest}>
          {processChildren(children)}
        </code>
      )
    },
    pre(props) {
      const { node } = props
      if (!withCodeBlocks) {
        const codeChild = node?.children?.[0] as { children?: { value?: string }[] }
        const code = codeChild?.children?.[0]?.value ?? ""
        return (
          <pre>
            <code>{code}</code>
          </pre>
        )
      }
      const codeChild = node?.children?.[0] as {
        properties?: { className?: string[] }
        children?: { value?: string }[]
      }
      const code = codeChild?.children?.[0]?.value?.replace(/\n$/, "") ?? ""
      const langClass = codeChild?.properties?.className?.find((c: string) =>
        c?.startsWith?.("language-"),
      )
      const language = langClass?.replace("language-", "") ?? "text"
      return <CodeBlock code={code} language={language} isDark={isDark} />
    },
  }
}

/**
 * Renders markdown content with support for GFM, linkification, and optional code blocks.
 */
export function MarkdownContent({
  /** The markdown content to render */
  children,
  /** Optional className for the container */
  className,
  /** Whether to include code block syntax highlighting (default: true) */
  withCodeBlocks = true,
  /** Size variant for typography (default: "sm") */
  size = "sm",
}: MarkdownContentProps) {
  const { isDark } = useAgentViewContext()
  const components = createMarkdownComponents(isDark, withCodeBlocks)

  return (
    <div
      className={cx(
        "prose dark:prose-invert max-w-none",
        size === "sm" ? "prose-sm" : "prose-base",
        "prose-p:my-1 prose-p:leading-snug",
        "prose-strong:font-medium",
        "prose-a:text-link prose-a:no-underline hover:prose-a:underline",
        "prose-code:text-status-success prose-code:font-normal prose-code:font-mono",
        size === "sm" ? "prose-code:text-xs" : "prose-code:text-sm",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:my-2 prose-pre:border-0 prose-pre:bg-transparent prose-pre:p-0",
        "prose-blockquote:not-italic prose-blockquote:font-normal",
        "prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

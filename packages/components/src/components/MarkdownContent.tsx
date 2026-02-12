import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "../lib/cn"
import { TextWithLinks } from "./TextWithLinks"
import type { TextWithLinksLinkHandlers } from "./TextWithLinks"
import { CodeBlock } from "./CodeBlock"
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
  /** Whether to use dark theme (default: false) */
  isDark?: boolean
  /** Optional link handlers for task ID and session reference linkification */
  linkHandlers?: TextWithLinksLinkHandlers
}

/** Process children and replace text nodes with links. */
function processChildren(
  /** The child element to process */
  children: ReactNode,
  /** Optional link handlers */
  linkHandlers?: TextWithLinksLinkHandlers,
): ReactNode {
  if (typeof children === "string") {
    return <TextWithLinks linkHandlers={linkHandlers}>{children}</TextWithLinks>
  }
  return children
}

/** Create markdown components with link support and code blocks. */
function createMarkdownComponents(
  /** Whether to use dark theme */
  isDark: boolean,
  /** Whether to render code blocks with syntax highlighting */
  withCodeBlocks: boolean,
  /** Optional link handlers */
  linkHandlers?: TextWithLinksLinkHandlers,
): Components {
  return {
    p(props) {
      const { children, ...rest } = props
      return <p {...rest}>{processChildren(children, linkHandlers)}</p>
    },
    li(props) {
      const { children, ...rest } = props
      return <li {...rest}>{processChildren(children, linkHandlers)}</li>
    },
    strong(props) {
      const { children, ...rest } = props
      return <strong {...rest}>{processChildren(children, linkHandlers)}</strong>
    },
    em(props) {
      const { children, ...rest } = props
      return <em {...rest}>{processChildren(children, linkHandlers)}</em>
    },
    code(props) {
      const { children, className: codeClassName, ...rest } = props
      return (
        <code className={codeClassName} {...rest}>
          {processChildren(children, linkHandlers)}
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
  /** Whether to use dark theme (default: false) */
  isDark = false,
  /** Optional link handlers for task ID and session reference linkification */
  linkHandlers,
}: MarkdownContentProps) {
  const components = createMarkdownComponents(isDark, withCodeBlocks, linkHandlers)

  return (
    <div
      className={cn(
        "prose dark:prose-invert max-w-none",
        size === "sm" ? "prose-sm" : "prose-base",
        "prose-p:my-1 prose-p:leading-snug",
        "prose-h1:text-lg prose-h2:text-sm prose-h3:text-xs prose-h4:text-xs",
        "prose-h1:font-semibold prose-h2:font-semibold prose-h3:font-medium prose-h4:font-medium",
        "prose-h1:border-b prose-h1:border-border prose-h1:pb-1",
        "prose-h2:border-b prose-h2:border-border prose-h2:pb-1",
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

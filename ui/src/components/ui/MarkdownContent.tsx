import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { TextWithLinks } from "@/components/ui/TextWithLinks"
import { CodeBlock } from "@/components/ui/code-block"
import { useTheme } from "@/hooks/useTheme"
import { useAppStore, selectAccentColor } from "@/store"
import { DEFAULT_ACCENT_COLOR } from "@/constants"
import type { Components } from "react-markdown"
import type { ReactNode } from "react"

// Types

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

/**  Process children and replace text nodes with links (task IDs and event logs). */
function processChildren(
  /** The child element to process */
  children: ReactNode,
): ReactNode {
  if (typeof children === "string") {
    return <TextWithLinks>{children}</TextWithLinks>
  }
  return children
}

/**  Create markdown components with link support for task IDs and event logs. */
function createMarkdownComponents(
  /** Whether to use dark theme */
  isDark: boolean,
  /** Whether to render code blocks with syntax highlighting */
  withCodeBlocks: boolean,
): Components {
  return {
    // Process text in paragraph elements
    p(props) {
      const { children, ...rest } = props
      return <p {...rest}>{processChildren(children)}</p>
    },
    // Process text in list items
    li(props) {
      const { children, ...rest } = props
      return <li {...rest}>{processChildren(children)}</li>
    },
    // Process text in strong elements
    strong(props) {
      const { children, ...rest } = props
      return <strong {...rest}>{processChildren(children)}</strong>
    },
    // Process text in emphasis elements
    em(props) {
      const { children, ...rest } = props
      return <em {...rest}>{processChildren(children)}</em>
    },
    code(props) {
      const { children, className: codeClassName, ...rest } = props
      // Inline code only - fenced code blocks are handled in the pre component
      return (
        <code className={codeClassName} {...rest}>
          {processChildren(children)}
        </code>
      )
    },
    pre(props) {
      const { node } = props
      if (!withCodeBlocks) {
        // Without code blocks, render as plain pre
        const codeChild = node?.children?.[0] as { children?: { value?: string }[] }
        const code = codeChild?.children?.[0]?.value ?? ""
        return (
          <pre>
            <code>{code}</code>
          </pre>
        )
      }
      // Extract code and language from the AST node
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
 * Renders markdown content with support for GFM (GitHub Flavored Markdown),
 * task ID linking, event log linking, and optional syntax-highlighted code blocks.
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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const accentColor = useAppStore(selectAccentColor)
  const linkColor = accentColor ?? DEFAULT_ACCENT_COLOR
  const components = createMarkdownComponents(isDark, withCodeBlocks)

  return (
    <div
      className={cn(
        "prose dark:prose-invert max-w-none",
        size === "sm" ? "prose-sm" : "prose-base",
        "prose-p:my-1 prose-p:leading-snug",
        "prose-strong:font-medium",
        "prose-a:no-underline hover:prose-a:underline",
        "prose-code:text-muted-foreground prose-code:text-xs prose-code:font-normal prose-code:font-mono",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:my-2 prose-pre:border-0 prose-pre:bg-transparent prose-pre:p-0",
        "prose-blockquote:not-italic",
        "prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        className,
      )}
      style={{ "--tw-prose-links": linkColor } as React.CSSProperties}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

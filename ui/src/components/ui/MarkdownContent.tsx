import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { TaskIdLink } from "@/components/ui/TaskIdLink"
import { CodeBlock } from "@/components/ui/code-block"
import { useTheme } from "@/hooks/useTheme"
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

// Helper to process children and replace text nodes with TaskIdLink
function processChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    return <TaskIdLink>{children}</TaskIdLink>
  }
  return children
}

// Create markdown components with TaskIdLink support
function createMarkdownComponents(isDark: boolean, withCodeBlocks: boolean): Components {
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

      if (withCodeBlocks) {
        // Check if this is a code block (inside a pre) by looking at the className
        // react-markdown adds language-xxx class for fenced code blocks
        const match = /language-(\w+)/.exec(codeClassName || "")

        // If it has a language class, it's a fenced code block
        if (match) {
          const language = match[1]
          const code = String(children).replace(/\n$/, "")
          return <CodeBlock code={code} language={language} isDark={isDark} />
        }
      }

      // Otherwise it's inline code - process for task IDs
      return (
        <code className={codeClassName} {...rest}>
          {processChildren(children)}
        </code>
      )
    },
    pre(props) {
      const { children } = props
      // If the child is already a CodeBlock, just render it directly
      // Otherwise wrap in pre as normal
      return <>{children}</>
    },
  }
}

/**
 * Renders markdown content with support for GFM (GitHub Flavored Markdown),
 * task ID linking, and optional syntax-highlighted code blocks.
 */
export function MarkdownContent({
  children,
  className,
  withCodeBlocks = true,
  size = "sm",
}: MarkdownContentProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const components = createMarkdownComponents(isDark, withCodeBlocks)

  return (
    <div
      className={cn(
        "prose dark:prose-invert max-w-none",
        size === "sm" ? "prose-sm" : "prose-base",
        "prose-p:my-1 prose-p:leading-snug",
        "prose-strong:font-medium",
        "prose-a:text-cyan-600 dark:prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline",
        "prose-code:text-muted-foreground prose-code:text-xs prose-code:font-normal prose-code:font-mono",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:my-2 prose-pre:border-0 prose-pre:bg-transparent prose-pre:p-0",
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

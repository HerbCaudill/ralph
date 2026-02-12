import { MarkdownContent } from "@herbcaudill/components"
import { formatRelativeTime } from "../../lib/formatRelativeTime"
import type { Comment } from "../../types"

export function CommentItem({ comment }: Props) {
  return (
    <div className="border-border border-b pb-3 last:border-0 last:pb-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-foreground text-xs font-medium">{comment.author}</span>
        <span className="text-muted-foreground text-xs">
          {formatRelativeTime(comment.created_at)}
        </span>
      </div>
      <MarkdownContent className="text-xs" withCodeBlocks={false}>
        {comment.text}
      </MarkdownContent>
    </div>
  )
}

type Props = {
  comment: Comment
}

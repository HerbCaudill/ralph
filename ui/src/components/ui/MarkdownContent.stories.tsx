import type { Meta, StoryObj } from "@storybook/react-vite"
import { MarkdownContent } from "./MarkdownContent"

const meta: Meta<typeof MarkdownContent> = {
  title: "Content/MarkdownContent",
  component: MarkdownContent,
  parameters: {
    layout: "padded",
  },
  decorators: [
    Story => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const BasicText: Story = {
  args: {
    children: "This is a simple paragraph of text rendered with markdown support.",
  },
}

export const Headings: Story = {
  args: {
    children: `# Heading 1
## Heading 2
### Heading 3
#### Heading 4`,
  },
}

export const FormattedText: Story = {
  args: {
    children: `This text has **bold**, *italic*, and ~~strikethrough~~ formatting.

You can also use \`inline code\` for technical terms.`,
  },
}

export const Lists: Story = {
  args: {
    children: `Here's an unordered list:
- First item
- Second item
- Third item with nested items
  - Nested item 1
  - Nested item 2

And an ordered list:
1. Step one
2. Step two
3. Step three`,
  },
}

export const CodeBlock: Story = {
  args: {
    children: `Here's a code example:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet("World");
console.log(message);
\`\`\``,
  },
}

export const MultipleCodeBlocks: Story = {
  args: {
    children: `Install the dependencies:

\`\`\`bash
npm install react react-dom
\`\`\`

Then create a component:

\`\`\`tsx
export function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}
\`\`\``,
  },
}

export const Blockquote: Story = {
  args: {
    children: `> This is a blockquote.
> It can span multiple lines.
>
> And have multiple paragraphs.`,
  },
}

export const Links: Story = {
  args: {
    children: `Check out [React documentation](https://react.dev) for more info.

You can also link to [GitHub](https://github.com) or [MDN](https://developer.mozilla.org).`,
  },
}

export const Table: Story = {
  args: {
    children: `| Feature | Status | Notes |
| ------- | ------ | ----- |
| Auth | Done | Using OAuth |
| API | In Progress | RESTful design |
| UI | Planned | React + Tailwind |`,
  },
}

export const MixedContent: Story = {
  args: {
    children: `# Project Status

The project is progressing well. Here's a summary:

## Completed Tasks

- **Authentication**: Implemented OAuth2 flow
- **Database**: Set up PostgreSQL with migrations
- **API**: Created REST endpoints for \`/users\` and \`/posts\`

## Code Example

\`\`\`typescript
const api = createApi({
  baseUrl: '/api/v1',
  endpoints: (builder) => ({
    getUsers: builder.query<User[], void>({
      query: () => '/users',
    }),
  }),
});
\`\`\`

## Next Steps

1. Add unit tests
2. Set up CI/CD pipeline
3. Deploy to staging

> Note: All deadlines are subject to change based on team capacity.`,
  },
}

export const SmallSize: Story = {
  args: {
    children: `This is **small** text with \`code\` and a [link](https://example.com).`,
    size: "sm",
  },
}

export const BaseSize: Story = {
  args: {
    children: `This is **base size** text with \`code\` and a [link](https://example.com).`,
    size: "base",
  },
}

export const WithoutCodeBlocks: Story = {
  args: {
    children: `Here's some code that won't be syntax highlighted:

\`\`\`typescript
const x = 1;
\`\`\`

It will render as plain preformatted text.`,
    withCodeBlocks: false,
  },
}

export const InlineCodeOnly: Story = {
  args: {
    children: `Use the \`useState\` hook for local state and \`useContext\` for shared state.

The \`useEffect\` hook handles side effects like \`fetch\` calls.`,
  },
}

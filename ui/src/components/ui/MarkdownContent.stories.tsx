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

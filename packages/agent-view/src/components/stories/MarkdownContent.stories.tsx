import type { Meta, StoryObj } from "@storybook/react-vite"
import { MarkdownContent } from ".././MarkdownContent"

const meta: Meta<typeof MarkdownContent> = {
  title: "Content/MarkdownContent",
  component: MarkdownContent,
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
    children: `This is **normal** text with \`code\` and a [link](https://example.com).`,
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

export const MixedContent: Story = {
  args: {
    children: `# Project Status

The project is progressing well. Here's a summary.

## Completed Tasks

- **Authentication**: Implemented OAuth2 flow
- **Database**: Set up PostgreSQL with migrations
- **API**: Created REST endpoints for \`/users\` and \`/posts\`

## Feature Comparison

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Auth | ✅ Complete | OAuth2 + JWT |
| Database | ✅ Complete | PostgreSQL |
| REST API | 🚧 In Progress | 80% complete |

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

1. Add unit tests for all API endpoints
2. Set up CI/CD pipeline
3. Deploy to staging environment

### Note 

> The choice of PostgreSQL over MongoDB was driven by our need for strong consistency
> and complex relational queries.

---

For more information, see the [project documentation](https://example.com/docs).`,
  },
}

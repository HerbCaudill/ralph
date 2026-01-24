import type { Meta, StoryObj } from "@storybook/react-vite"
import { MarkdownContent } from "./MarkdownContent"

const meta: Meta<typeof MarkdownContent> = {
  title: "Content/MarkdownContent",
  component: MarkdownContent,
  parameters: {
    
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

The project is progressing well. Here's a summary of where we stand and what's coming next.
This paragraph spans multiple lines to test how the renderer handles longer text content
that wraps naturally within the container.

## Completed Tasks

- **Authentication**: Implemented OAuth2 flow with support for Google, GitHub, and Microsoft
  providers. The implementation includes token refresh logic and secure storage of credentials
  in the browser's local storage with encryption.
- **Database**: Set up PostgreSQL with migrations using Drizzle ORM. Created initial schema
  for users, posts, and comments tables with proper foreign key relationships.
- **API**: Created REST endpoints for \`/users\` and \`/posts\`
  - GET endpoints with pagination and filtering
  - POST endpoints with validation
  - PUT/PATCH for updates
  - DELETE with soft-delete support

## Feature Comparison

| Feature | Status | Owner | Notes |
| ------- | ------ | ----- | ----- |
| User Authentication | ✅ Complete | @alice | OAuth2 + JWT |
| Database Schema | ✅ Complete | @bob | PostgreSQL + Drizzle |
| REST API | 🚧 In Progress | @charlie | 80% complete |
| WebSocket Events | 📋 Planned | TBD | Q2 2024 |
| Mobile App | 📋 Planned | TBD | Q3 2024 |

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
   - Focus on edge cases and error handling
   - Aim for 80% code coverage
2. Set up CI/CD pipeline
   - GitHub Actions for automated testing
   - Vercel for preview deployments
3. Deploy to staging environment

## Technical Decisions

We made several important architectural decisions during this phase:

> The choice of PostgreSQL over MongoDB was driven by our need for strong consistency
> and complex relational queries. While MongoDB would have been simpler for rapid
> prototyping, the long-term benefits of a relational database outweigh the initial
> setup complexity.

### Nested Lists Example

- Frontend technologies
  - React 18 with concurrent features
  - TypeScript for type safety
  - Tailwind CSS for styling
    - Custom design tokens
    - Dark mode support
- Backend technologies
  - Node.js with Express
  - PostgreSQL database
  - Redis for caching

---

## Links and References

For more information, see the [project documentation](https://example.com/docs) or contact
the [development team](mailto:dev@example.com). You can also check the inline code reference
to \`src/api/routes.ts\` for the API implementation details.

**Important:** Remember to update the \`README.md\` file before the next release.`,
  },
}

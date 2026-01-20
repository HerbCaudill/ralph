import type { Meta, StoryObj } from "@storybook/react-vite"
import { AssistantText } from "./AssistantText"

const meta: Meta<typeof AssistantText> = {
  title: "Events/AssistantText",
  component: AssistantText,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
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

export const Default: Story = {
  args: {
    event: {
      type: "text",
      timestamp: Date.now(),
      content: "I can help you with that. Let me take a look at the code.",
    },
  },
}

export const WithMarkdown: Story = {
  args: {
    event: {
      type: "text",
      timestamp: Date.now(),
      content: `Here's what I found:

## Key Issues

1. The authentication flow has a **race condition**
2. Tests are failing due to missing mocks
3. Consider using \`async/await\` instead of callbacks

Let me fix these for you.`,
    },
  },
}

export const WithCodeBlock: Story = {
  args: {
    event: {
      type: "text",
      timestamp: Date.now(),
      content: `I'll update the configuration:

\`\`\`typescript
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json();
}
\`\`\`

This should fix the issue.`,
    },
  },
}

export const WithInlineCode: Story = {
  args: {
    event: {
      type: "text",
      timestamp: Date.now(),
      content:
        "The error is in the `validateToken` function. You need to check if `token.length > 0` before proceeding.",
    },
  },
}

export const WithLinks: Story = {
  args: {
    event: {
      type: "text",
      timestamp: Date.now(),
      content:
        "Check out the [documentation](https://docs.example.com) for more details. You can also see the [GitHub issue](https://github.com/example/repo/issues/123).",
    },
  },
}

export const WithList: Story = {
  args: {
    event: {
      type: "text",
      timestamp: Date.now(),
      content: `I'll make these changes:

- Fix the authentication bug
- Add proper error handling
- Update the tests
- Run the linter`,
    },
  },
}

export const ShortResponse: Story = {
  args: {
    event: {
      type: "text",
      timestamp: Date.now(),
      content: "Done! The changes have been committed.",
    },
  },
}

export const LongResponse: Story = {
  args: {
    event: {
      type: "text",
      timestamp: Date.now(),
      content: `I've analyzed the codebase and found several areas that need attention.

The authentication module has some security concerns. The current implementation uses a simple length check which isn't sufficient for production use.

I recommend:

1. **JWT Validation** - Use proper JWT verification with the secret key
2. **Token Expiry** - Check that tokens haven't expired
3. **Rate Limiting** - Add rate limiting to prevent brute force attacks

The performance issues are mainly in the data fetching layer. Consider adding Redis caching for frequently accessed data, implementing cursor-based pagination, and using lazy loading where appropriate.

Let me know which area you'd like me to tackle first.`,
    },
  },
}

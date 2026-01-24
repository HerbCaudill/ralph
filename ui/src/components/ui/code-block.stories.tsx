import type { Meta, StoryObj } from "@storybook/react-vite"
import { CodeBlock } from "./code-block"

const meta: Meta<typeof CodeBlock> = {
  title: "UI/CodeBlock",
  component: CodeBlock,
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

export const TypeScript: Story = {
  args: {
    code: `interface User {
  id: string;
  name: string;
  email: string;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}`,
    language: "typescript",
  },
}

export const JavaScript: Story = {
  args: {
    code: `const fetchUsers = async () => {
  const response = await fetch('/api/users');
  const data = await response.json();
  return data;
};

fetchUsers().then(users => console.log(users));`,
    language: "javascript",
  },
}

export const React: Story = {
  args: {
    code: `export function Button({ label, onClick }: ButtonProps) {
  return (
    <button
      className="bg-blue-500 text-white px-4 py-2 rounded"
      onClick={onClick}
    >
      {label}
    </button>
  );
}`,
    language: "tsx",
  },
}

export const Python: Story = {
  args: {
    code: `def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n numbers."""
    if n <= 0:
        return []

    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])

    return sequence[:n]

print(fibonacci(10))`,
    language: "python",
  },
}

export const JSON: Story = {
  args: {
    code: `{
  "name": "my-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}`,
    language: "json",
  },
}

export const CSS: Story = {
  args: {
    code: `.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  background-color: var(--primary);
  color: white;
  transition: background-color 0.2s;
}

.button:hover {
  background-color: var(--primary-dark);
}`,
    language: "css",
  },
}

export const Bash: Story = {
  args: {
    code: `#!/bin/bash

# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

echo "Build complete!"`,
    language: "bash",
  },
}

export const SQL: Story = {
  args: {
    code: `SELECT
  u.id,
  u.name,
  COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name
ORDER BY post_count DESC
LIMIT 10;`,
    language: "sql",
  },
}

export const PlainText: Story = {
  args: {
    code: `This is plain text without any syntax highlighting.
It can contain multiple lines.
No special formatting will be applied.`,
    language: "text",
  },
}

export const WithCopyButton: Story = {
  args: {
    code: `const secret = "copy-me";`,
    language: "typescript",
    showCopy: true,
  },
}

export const WithoutCopyButton: Story = {
  args: {
    code: `const secret = "no-copy";`,
    language: "typescript",
    showCopy: false,
  },
}

export const LongCode: Story = {
  args: {
    code: Array.from(
      { length: 30 },
      (_, i) => `const line${i + 1} = "This is line ${i + 1} of a long code block";`,
    ).join("\n"),
    language: "typescript",
  },
}

export const WideCode: Story = {
  args: {
    code: `const veryLongVariableName = someFunctionWithManyParameters(parameterOne, parameterTwo, parameterThree, parameterFour, parameterFive, parameterSix);`,
    language: "typescript",
  },
}

export const DarkTheme: Story = {
  args: {
    code: `function example() {
  return "dark theme";
}`,
    language: "typescript",
    isDark: true,
  },
}

export const LightTheme: Story = {
  args: {
    code: `function example() {
  return "light theme";
}`,
    language: "typescript",
    isDark: false,
  },
}

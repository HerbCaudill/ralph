import type { Meta, StoryObj } from "@storybook/react-vite"
import { AnsiOutput } from "./AnsiOutput"
import { fn } from "storybook/test"

const meta: Meta<typeof AnsiOutput> = {
  title: "Feedback/AnsiOutput",
  component: AnsiOutput,
  parameters: {
    layout: "padded",
  },
  args: {
    isExpanded: false,
    onExpand: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const SimpleOutput: Story = {
  args: {
    code: `Hello, World!
This is plain text output.
Line 3 of the output.`,
  },
}

export const WithAnsiCodes: Story = {
  args: {
    code: `\x1b[32m✓\x1b[0m Test passed
\x1b[31m✗\x1b[0m Test failed
\x1b[33m⚠\x1b[0m Warning message
\x1b[34mℹ\x1b[0m Info message`,
  },
}

export const TestOutput: Story = {
  args: {
    code: `\x1b[32m✓\x1b[0m src/components/Button.test.tsx (5 tests) 42ms
\x1b[32m✓\x1b[0m src/components/Input.test.tsx (8 tests) 38ms
\x1b[32m✓\x1b[0m src/hooks/useAuth.test.ts (12 tests) 65ms
\x1b[32m✓\x1b[0m src/utils/format.test.ts (20 tests) 23ms

\x1b[32mTest Files\x1b[0m  4 passed (4)
     \x1b[32mTests\x1b[0m  45 passed (45)
  Start at  14:32:10
  Duration  1.2s`,
  },
}

export const ErrorOutput: Story = {
  args: {
    code: `\x1b[31merror\x1b[0m TS2339: Property 'foo' does not exist on type 'User'.

  src/components/UserCard.tsx:15:22
    15   return <div>{user.foo}</div>
                          \x1b[31m~~~\x1b[0m

\x1b[31mFound 1 error.\x1b[0m`,
  },
}

export const LongOutputTruncated: Story = {
  args: {
    code: Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: Processing item ${i + 1}...`).join(
      "\n",
    ),
    isExpanded: false,
  },
}

export const LongOutputExpanded: Story = {
  args: {
    code: Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: Processing item ${i + 1}...`).join(
      "\n",
    ),
    isExpanded: true,
  },
}

export const GitStatus: Story = {
  args: {
    code: `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	\x1b[31mmodified:   src/App.tsx\x1b[0m
	\x1b[31mmodified:   src/components/Header.tsx\x1b[0m

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	\x1b[31msrc/components/NewComponent.tsx\x1b[0m

no changes added to commit (use "git add" and/or "git commit -a")`,
  },
}

export const NpmInstall: Story = {
  args: {
    code: `\x1b[32madded\x1b[0m 245 packages, and audited 246 packages in 3s

\x1b[32m42\x1b[0m packages are looking for funding
  run \`npm fund\` for details

found \x1b[33m0\x1b[0m vulnerabilities`,
  },
}

export const BuildOutput: Story = {
  args: {
    code: `vite v5.0.0 building for production...
✓ 1234 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-abc123.css     15.23 kB │ gzip:  3.45 kB
dist/assets/index-def456.js     245.67 kB │ gzip: 78.90 kB
✓ built in 2.34s`,
  },
}

export const Empty: Story = {
  args: {
    code: "",
  },
}

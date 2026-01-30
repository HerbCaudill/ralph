import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThinkingBlock } from "./ThinkingBlock"

const meta: Meta<typeof ThinkingBlock> = {
  title: "Feedback/ThinkingBlock",
  component: ThinkingBlock,
  parameters: {},
  args: {
    content:
      "I should scan the repository for relevant files, identify where the issue arises, and then propose a minimal fix. First, locate the failing test output. Then inspect the affected components and verify whether the behavior mismatch is from a regression or a spec change.",
    defaultExpanded: true,
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

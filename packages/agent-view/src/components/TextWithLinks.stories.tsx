import type { Meta, StoryObj } from "@storybook/react-vite"
import { TextWithLinks } from "./TextWithLinks"

const meta: Meta<typeof TextWithLinks> = {
  title: "Content/TextWithLinks",
  component: TextWithLinks,
}

export default meta
type Story = StoryObj<typeof meta>

export const PlainText: Story = {
  args: {
    children: "This is plain text without any links.",
  },
}

export const WithSessionReference: Story = {
  args: {
    children: "See the session at /session/default-1706123456789 for details.",
  },
}

export const LongText: Story = {
  args: {
    children: `This is a longer piece of text that contains some references.

You can view the session history at /session/session-abcd1234 and /session/session-efgh5678.`,
  },
}

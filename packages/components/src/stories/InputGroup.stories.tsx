import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconSearch, IconSend, IconMail, IconEye, IconEyeOff } from "@tabler/icons-react"
import { useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "../components/input-group"

const meta = {
  title: "InputGroup",
  component: InputGroup,
  decorators: [
    Story => (
      <div className="w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InputGroup>

export default meta
type Story = StoryObj<typeof meta>

export const WithSearchIcon: Story = {
  render: () => (
    <InputGroup>
      <InputGroupAddon>
        <IconSearch className="h-4 w-4" />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." />
    </InputGroup>
  ),
}

export const WithButton: Story = {
  render: () => (
    <InputGroup>
      <InputGroupInput placeholder="Type a message..." />
      <InputGroupAddon align="inline-end">
        <InputGroupButton>
          <IconSend className="h-4 w-4" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const WithPrefix: Story = {
  render: () => (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>
          <IconMail className="h-4 w-4" />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="Email address" type="email" />
    </InputGroup>
  ),
}

export const WithTextarea: Story = {
  render: () => (
    <InputGroup>
      <InputGroupTextarea placeholder="Write a comment..." rows={3} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton>
          <IconSend className="h-4 w-4" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const PasswordToggle: Story = {
  render: function PasswordToggleStory() {
    const [show, setShow] = useState(false)
    return (
      <InputGroup>
        <InputGroupInput type={show ? "text" : "password"} placeholder="Password" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={() => setShow(!show)}>
            {show ?
              <IconEyeOff className="h-4 w-4" />
            : <IconEye className="h-4 w-4" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    )
  },
}

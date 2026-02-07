import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconBold, IconItalic, IconUnderline, IconAlignLeft, IconAlignCenter, IconAlignRight } from "@tabler/icons-react"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "../components/button-group"
import { Button } from "../components/button"

const meta = {
  title: "ButtonGroup",
  component: ButtonGroup,
} satisfies Meta<typeof ButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="sm"><IconBold /></Button>
      <Button variant="outline" size="sm"><IconItalic /></Button>
      <Button variant="outline" size="sm"><IconUnderline /></Button>
    </ButtonGroup>
  ),
}

export const WithText: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="sm">Copy</Button>
      <Button variant="outline" size="sm">Cut</Button>
      <Button variant="outline" size="sm">Paste</Button>
    </ButtonGroup>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline" size="sm"><IconAlignLeft /> Left</Button>
      <Button variant="outline" size="sm"><IconAlignCenter /> Center</Button>
      <Button variant="outline" size="sm"><IconAlignRight /> Right</Button>
    </ButtonGroup>
  ),
}

export const WithSeparator: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="sm"><IconBold /></Button>
      <Button variant="outline" size="sm"><IconItalic /></Button>
      <ButtonGroupSeparator />
      <Button variant="outline" size="sm"><IconAlignLeft /></Button>
      <Button variant="outline" size="sm"><IconAlignCenter /></Button>
      <Button variant="outline" size="sm"><IconAlignRight /></Button>
    </ButtonGroup>
  ),
}

export const WithGroupText: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>Format</ButtonGroupText>
      <Button variant="outline" size="sm"><IconBold /></Button>
      <Button variant="outline" size="sm"><IconItalic /></Button>
      <Button variant="outline" size="sm"><IconUnderline /></Button>
    </ButtonGroup>
  ),
}

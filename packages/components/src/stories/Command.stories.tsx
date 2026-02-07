import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCalendar, IconMail, IconSettings, IconUser } from "@tabler/icons-react"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "../components/command"

const meta = {
  title: "Command",
  component: Command,
} satisfies Meta<typeof Command>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Command className="rounded-lg border shadow-md" style={{ width: 350 }}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            <IconCalendar /> Calendar
          </CommandItem>
          <CommandItem>
            <IconMail /> Mail
          </CommandItem>
          <CommandItem>
            <IconUser /> Profile
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>
            <IconSettings /> Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
}

export const WithDisabledItems: Story = {
  render: () => (
    <Command className="rounded-lg border shadow-md" style={{ width: 350 }}>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem>Save</CommandItem>
          <CommandItem>Copy</CommandItem>
          <CommandItem disabled>Paste (disabled)</CommandItem>
          <CommandItem>Delete</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
}

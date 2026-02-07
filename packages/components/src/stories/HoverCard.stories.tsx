import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCalendar } from "@tabler/icons-react"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../components/hover-card"
import { Button } from "../components/button"

const meta = {
  title: "HoverCard",
  component: HoverCard,
} satisfies Meta<typeof HoverCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">Hover me</Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex justify-between space-x-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">@herbcaudill</h4>
            <p className="text-sm">Building things with code.</p>
            <div className="flex items-center pt-2">
              <IconCalendar className="mr-2 h-4 w-4 opacity-70" />
              <span className="text-muted-foreground text-xs">Joined December 2021</span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
}

import type { HotkeyAction, HotkeyConfig } from "@/config"
import { getHotkeyDisplayString } from "@/lib/getHotkeyDisplayString"
import { Kbd } from "@/components/ui/tooltip"

export function HotkeyRow({ config }: Props) {
  const display = getHotkeyDisplayString(config)

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-foreground text-sm">{config.description}</span>
      <Kbd className="ml-4 shrink-0 px-2 py-1">{display}</Kbd>
    </div>
  )
}

type Props = {
  action: HotkeyAction
  config: HotkeyConfig
}

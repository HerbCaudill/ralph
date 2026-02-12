import logoSvg from "@/assets/logo.svg?raw"

/**
 * Application logo component displaying the Ralph robot icon and name.
 * The logo.svg uses currentColor for stroke, so it inherits the text color from its parent.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2" data-testid="logo">
      <div className="h-5.5 w-7" dangerouslySetInnerHTML={{ __html: logoSvg }} />
      <span className="text-lg font-semibold">Ralph</span>
    </div>
  )
}

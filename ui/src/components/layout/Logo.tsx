/**
 * Application logo component displaying the Ralph robot icon and name.
 * Uses currentColor to inherit from the surrounding text color.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="22"
        viewBox="0 0 719.4 552.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="42"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Head outline */}
        <path d="M83.9,392.8c152.4,152.4,399.1,152.4,551.5,0,0,0,0-233.6,0-233.6C483,6.8,236.4,6.8,83.9,159.2c0,0,0,233.6,0,233.6Z" />
        {/* Hair/antenna lines */}
        <line x1="359.7" y1="44.9" x2="359.7" y2="175.1" />
        <line x1="462.5" y1="58.7" x2="462.5" y2="175.1" />
        <line x1="565.3" y1="103.5" x2="565.3" y2="175.1" />
        <line x1="256.9" y1="58.7" x2="256.9" y2="175.1" />
        <line x1="154.1" y1="103.5" x2="154.1" y2="175.1" />
        {/* Eyes */}
        <line x1="256.9" y1="269.4" x2="256.9" y2="282.6" />
        <line x1="462.5" y1="269.4" x2="462.5" y2="282.6" />
        {/* Ears */}
        <rect x="39.5" y="257.4" width="37.3" height="37.3" />
        <rect x="642.6" y="257.4" width="37.3" height="37.3" />
      </svg>
      <span className="text-lg font-semibold">Ralph</span>
    </div>
  )
}

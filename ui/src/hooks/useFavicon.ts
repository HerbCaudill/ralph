import { useEffect } from "react"
import logoSvg from "@/assets/logo.svg?raw"

/**
 * Sets the favicon using the logo.svg as the source.
 * Call this once at the app root to set the favicon.
 */
export function useFavicon() {
  useEffect(() => {
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(logoSvg)}`
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) {
      link.href = dataUrl
    } else {
      const newLink = document.createElement("link")
      newLink.rel = "icon"
      newLink.type = "image/svg+xml"
      newLink.href = dataUrl
      document.head.appendChild(newLink)
    }
  }, [])
}

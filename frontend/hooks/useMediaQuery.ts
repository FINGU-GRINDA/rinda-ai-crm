import { useEffect, useState } from "react"

/**
 * Custom hook for responsive design media queries
 * @param query - Media query string (e.g., '(max-width: 767px)')
 * @returns boolean indicating if the media query matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    // Set initial value
    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    // Create listener
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }

    // Add listener
    media.addEventListener("change", listener)

    // Cleanup
    return () => media.removeEventListener("change", listener)
  }, [query, matches])

  return matches
}

/**
 * Check if viewport is mobile (< 768px)
 */
export const useIsMobile = (): boolean => {
  return useMediaQuery("(max-width: 767px)")
}

/**
 * Check if viewport is tablet (768px - 1023px)
 */
export const useIsTablet = (): boolean => {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
}

/**
 * Check if viewport is desktop (>= 1024px)
 */
export const useIsDesktop = (): boolean => {
  return useMediaQuery("(min-width: 1024px)")
}

/**
 * Check if device supports touch
 */
export const useIsTouchDevice = (): boolean => {
  return useMediaQuery("(hover: none) and (pointer: coarse)")
}

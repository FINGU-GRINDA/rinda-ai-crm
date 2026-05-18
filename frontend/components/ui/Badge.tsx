import type React from "react"
import { type Tone, toneStyles } from "../../styles/design-tokens"

interface BadgeProps {
  tone?: Tone
  size?: "sm" | "md"
  showDot?: boolean
  className?: string
  children: React.ReactNode
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
} as const

export const Badge: React.FC<BadgeProps> = ({
  tone = "neutral",
  size = "sm",
  showDot = false,
  className = "",
  children,
}) => {
  const t = toneStyles[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${t.bg} ${t.text} ${sizeStyles[size]} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} aria-hidden="true" />}
      {children}
    </span>
  )
}

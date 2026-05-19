import type React from "react"
import {
  type CustomerStatusKey,
  type PriorityKey,
  priorityBadge,
  type SignalKey,
  signalBadge,
  statusBadge,
} from "../../styles/design-tokens"
import { Badge } from "./Badge"

type StatusBadgeProps =
  | {
      kind: "status"
      value: CustomerStatusKey | string
      showDot?: boolean
      size?: "sm" | "md"
      className?: string
    }
  | {
      kind: "priority"
      value: PriorityKey | string
      showDot?: boolean
      size?: "sm" | "md"
      className?: string
    }
  | {
      kind: "signal"
      value: SignalKey | string
      showDot?: boolean
      size?: "sm" | "md"
      className?: string
    }

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  kind,
  value,
  showDot = true,
  size = "sm",
  className,
}) => {
  const entry = (() => {
    if (kind === "status") return statusBadge[value as CustomerStatusKey]
    if (kind === "priority") return priorityBadge[value as PriorityKey]
    return signalBadge[value as SignalKey]
  })()

  if (!entry) {
    return (
      <Badge tone="neutral" size={size} className={className}>
        {String(value)}
      </Badge>
    )
  }

  return (
    <Badge tone={entry.tone} size={size} showDot={showDot} className={className}>
      {entry.label}
    </Badge>
  )
}

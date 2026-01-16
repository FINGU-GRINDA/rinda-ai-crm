/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now()
}

/**
 * Format timestamp to ISO string
 */
export function toISOString(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

/**
 * Format timestamp to Korean locale string
 */
export function toKoreanString(timestamp: number): string {
  return new Date(timestamp).toLocaleString("ko-KR")
}

/**
 * Get start of day timestamp
 */
export function startOfDay(timestamp: number = Date.now()): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Get end of day timestamp
 */
export function endOfDay(timestamp: number = Date.now()): number {
  const date = new Date(timestamp)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

/**
 * Add days to timestamp
 */
export function addDays(timestamp: number, days: number): number {
  return timestamp + days * 24 * 60 * 60 * 1000
}

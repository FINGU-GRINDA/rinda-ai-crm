/**
 * Generate a unique ID
 * Format: timestamp_randomString
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}

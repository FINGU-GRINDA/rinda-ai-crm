/**
 * API Response wrapper utilities
 * Ensures consistent response format across all endpoints
 *
 * Success: { success: true, data: T }
 * Success with count: { success: true, data: T[], count: number }
 * Error: { success: false, error: string, code?: string }
 */

// Success response for single item
export function success<T>(data: T): { success: true; data: T } {
  return { success: true, data }
}

// Success response for list with count
export function successList<T>(
  data: T[],
  count?: number,
): { success: true; data: T[]; count: number } {
  return { success: true, data, count: count ?? data.length }
}

// Error response
export function error(
  message: string,
  code?: string,
): { success: false; error: string; code?: string } {
  if (code) {
    return { success: false, error: message, code }
  }
  return { success: false, error: message }
}

// Error codes enum for consistency
export const ErrorCode = {
  NOT_FOUND: "NOT_FOUND",
  CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND",
  PROSPECT_NOT_FOUND: "PROSPECT_NOT_FOUND",
  CONTACT_NOT_FOUND: "CONTACT_NOT_FOUND",
  MEETING_NOT_FOUND: "MEETING_NOT_FOUND",
  NOTIFICATION_NOT_FOUND: "NOTIFICATION_NOT_FOUND",
  ICP_NOT_FOUND: "ICP_NOT_FOUND",
  SETTING_NOT_FOUND: "SETTING_NOT_FOUND",
  EMAIL_NOT_FOUND: "EMAIL_NOT_FOUND",
  EVENT_NOT_FOUND: "EVENT_NOT_FOUND",
  FOLLOWUP_NOT_FOUND: "FOLLOWUP_NOT_FOUND",
  MISSING_FIELDS: "MISSING_FIELDS",
  MISSING_COMPANY_NAME: "MISSING_COMPANY_NAME",
  MISSING_IMAGE: "MISSING_IMAGE",
  MISSING_AUDIO_OR_TRANSCRIPTION: "MISSING_AUDIO_OR_TRANSCRIPTION",
  MISSING_ICP_PROFILES: "MISSING_ICP_PROFILES",
  COLLECTION_RUNNING: "COLLECTION_RUNNING",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * Type Guard Utilities
 * Runtime type checking functions for API responses
 */

import type { ApiListResponse, ApiResponse } from "../../../elysia-server/src/types/api"

/**
 * Check if response is a successful list response
 * TypeScript will narrow the type to { success: true; data: T[]; count: number }
 */
export function isSuccessListResponse<T>(
  response: ApiListResponse<T>,
): response is { success: true; data: T[]; count: number } {
  return response.success === true && "data" in response && Array.isArray(response.data)
}

/**
 * Check if response is a successful single response
 * TypeScript will narrow the type to { success: true; data: T }
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>,
): response is { success: true; data: T } {
  return response.success === true && "data" in response
}

/**
 * Check if response is an error response
 * TypeScript will narrow the type to { success: false; error: string; code?: string }
 */
export function isErrorResponse(
  response: ApiResponse<unknown> | ApiListResponse<unknown>,
): response is { success: false; error: string; code?: string } {
  return response.success === false && "error" in response
}

/**
 * Extract error message from response
 * Returns error message if error response, undefined otherwise
 */
export function getErrorMessage(
  response: ApiResponse<unknown> | ApiListResponse<unknown>,
): string | undefined {
  if (isErrorResponse(response)) {
    return response.error
  }
  return undefined
}

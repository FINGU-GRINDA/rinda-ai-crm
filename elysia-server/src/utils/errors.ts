/**
 * AppError hierarchy — minimal subset of the source repo's pattern.
 *
 * The lifted CRM services throw `NotFoundError` and `BadRequestError`. The
 * error handler in `middleware/error-handler.ts` detects `AppError` instances
 * and returns the configured `status` + `code`.
 */

export interface AppErrorOptions {
  cause?: unknown
  code?: string
  details?: Record<string, unknown>
}

export class AppError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: Record<string, unknown>

  constructor(message: string, status: number, code: string, options?: AppErrorOptions) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = this.constructor.name
    this.status = status
    this.code = options?.code ?? code
    this.details = options?.details
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", options?: AppErrorOptions) {
    super(message, 404, "NOT_FOUND", options)
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", options?: AppErrorOptions) {
    super(message, 400, "BAD_REQUEST", options)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", options?: AppErrorOptions) {
    super(message, 401, "UNAUTHORIZED", options)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", options?: AppErrorOptions) {
    super(message, 403, "FORBIDDEN", options)
  }
}

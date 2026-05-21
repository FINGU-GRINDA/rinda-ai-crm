import { Elysia } from "elysia"
import { AppError } from "../utils/errors"
import { logger } from "../utils/logger"

export const errorHandler = new Elysia().onError(({ code, error, set }) => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  logger.error({ code, error: errorMessage }, `Error [${code}]: ${errorMessage}`)

  // Application-level errors carry their own status + code.
  if (error instanceof AppError) {
    set.status = error.status
    return { error: error.message, code: error.code }
  }

  switch (code) {
    case "NOT_FOUND":
      set.status = 404
      return { error: "Not found", code }

    case "VALIDATION":
      set.status = 400
      return { error: "Validation error", details: errorMessage, code }

    case "PARSE":
      set.status = 400
      return { error: "Parse error", details: errorMessage, code }

    case "INTERNAL_SERVER_ERROR":
      set.status = 500
      return { error: "Internal server error", code }

    default:
      set.status = 500
      return { error: errorMessage || "Unknown error", code }
  }
})

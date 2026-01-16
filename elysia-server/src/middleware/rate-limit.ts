import { Elysia } from "elysia"

interface RateLimitOptions {
  windowMs: number
  max: number
}

const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function createRateLimiter(options: RateLimitOptions = { windowMs: 60000, max: 100 }) {
  return new Elysia().onRequest(({ request, set }) => {
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

    const now = Date.now()
    const record = requestCounts.get(ip)

    if (!record || now > record.resetTime) {
      requestCounts.set(ip, { count: 1, resetTime: now + options.windowMs })
      return
    }

    record.count++

    if (record.count > options.max) {
      set.status = 429
      set.headers["Retry-After"] = String(Math.ceil((record.resetTime - now) / 1000))
      return { error: "Too many requests", retryAfter: Math.ceil((record.resetTime - now) / 1000) }
    }
  })
}

// Default rate limiter
export const rateLimiter = createRateLimiter()

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip)
    }
  }
}, 60000)

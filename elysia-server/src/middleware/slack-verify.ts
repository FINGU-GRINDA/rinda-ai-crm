import crypto from "node:crypto"
import { Elysia } from "elysia"
import { config } from "../config"
import { logger } from "../utils/logger"

export function verifySlackRequest(timestamp: string, body: string, signature: string): boolean {
  if (!config.SLACK_SIGNING_SECRET) {
    // Fail-closed: Only skip verification in development mode
    if (process.env.NODE_ENV === "development") {
      logger.warn("SLACK_SIGNING_SECRET not configured, skipping verification (dev mode only)")
      return true
    }
    logger.error("SLACK_SIGNING_SECRET not configured - rejecting request in production")
    return false
  }

  // Check timestamp is within 5 minutes (replay attack prevention)
  const currentTime = Math.floor(Date.now() / 1000)
  if (Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
    logger.warn({ timestamp, currentTime }, "Slack request timestamp too old (>5 minutes)")
    return false
  }

  const sigBasestring = `v0:${timestamp}:${body}`
  const mySignature =
    "v0=" +
    crypto.createHmac("sha256", config.SLACK_SIGNING_SECRET).update(sigBasestring).digest("hex")

  try {
    return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))
  } catch {
    return false
  }
}

export const slackVerifyMiddleware = new Elysia().derive(async ({ request }) => {
  const timestamp = request.headers.get("x-slack-request-timestamp")
  const signature = request.headers.get("x-slack-signature")

  // Clone request to read body
  const body = await request.clone().text()

  return {
    slackTimestamp: timestamp,
    slackSignature: signature,
    slackBody: body,
    isSlackVerified:
      timestamp && signature
        ? verifySlackRequest(timestamp, body, signature)
        : process.env.NODE_ENV === "development" && !config.SLACK_SIGNING_SECRET, // Only allow in dev mode
  }
})

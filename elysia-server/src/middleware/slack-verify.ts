import crypto from "node:crypto"
import { Elysia } from "elysia"
import { config } from "../config"
import { logger } from "../utils/logger"

export function verifySlackRequest(timestamp: string, body: string, signature: string): boolean {
  if (!config.SLACK_SIGNING_SECRET) {
    logger.warn("SLACK_SIGNING_SECRET not configured, skipping verification")
    return true // Skip verification if not configured
  }

  // Check timestamp is within 5 minutes
  const currentTime = Math.floor(Date.now() / 1000)
  if (Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
    logger.warn("Slack request timestamp too old")
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
        : !config.SLACK_SIGNING_SECRET, // Allow if not configured
  }
})

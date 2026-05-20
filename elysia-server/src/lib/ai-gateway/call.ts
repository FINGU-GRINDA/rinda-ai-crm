/**
 * Minimal AI-gateway wrapper around the Anthropic SDK.
 *
 * Slice 1 supports Anthropic only and skips the source repo's billing /
 * per-workspace usage tracking. The signature matches the source so lifted
 * services can call it without changes.
 *
 * Strategy: ask the model for JSON, strip any code fences, parse, validate
 * against the caller-supplied Zod schema. 2-attempt retry with jittered backoff
 * for transient 5xx / parse errors (matches blueprint §2.4).
 */

import Anthropic from "@anthropic-ai/sdk"
import type { z } from "zod"
import { config } from "../../config"
import logger from "../../utils/logger"

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured")
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

export interface CallAIObjectOptions<T> {
  /** Slice 1 only supports "anthropic". */
  provider?: "anthropic"
  model: string
  /** Used by source for usage tracking — ignored in slice 1. */
  feature?: string
  /** Used by source for per-workspace billing — ignored in slice 1. */
  workspaceId?: string
  /** Zod schema describing the expected JSON shape. */
  schema: z.ZodType<T>
  system: string
  prompt: string
  maxTokens?: number
}

export interface CallAIObjectResult<T> {
  object: T
}

const FENCE_RE = /^```(?:json)?\s*|\s*```$/gi

function stripCodeFences(text: string): string {
  return text.replace(FENCE_RE, "").trim()
}

export async function callAIObject<T>(
  options: CallAIObjectOptions<T>,
): Promise<CallAIObjectResult<T>> {
  const client = getAnthropicClient()
  const systemPrompt = `${options.system}\n\nRespond with ONLY a valid JSON object matching the required schema. No markdown, no commentary, no code fences.`

  const maxAttempts = 2
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: options.prompt }],
      })

      const textBlock = response.content.find((b) => b.type === "text")
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Anthropic response missing text content")
      }
      const raw = stripCodeFences(textBlock.text)

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (err) {
        // Do NOT include `raw` in the thrown message — model output can echo
        // back PII / customer email content from the prompt, which would then
        // be logged by the retry path below.
        throw new Error(
          `Anthropic JSON parse failed: ${err instanceof Error ? err.message : String(err)} (raw_length=${raw.length})`,
        )
      }

      const result = options.schema.safeParse(parsed)
      if (!result.success) {
        throw new Error(`Anthropic output failed Zod validation: ${result.error.message}`)
      }
      return { object: result.data }
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        const jitterMs = 500 + Math.random() * 200
        // Pass err.message rather than the err object so any nested stack /
        // captured content stays out of the structured log.
        const errMessage = err instanceof Error ? err.message : String(err)
        logger.warn(
          { feature: options.feature, attempt, jitterMs, err: errMessage },
          "[ai-gateway] callAIObject retry",
        )
        await new Promise((r) => setTimeout(r, jitterMs))
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`callAIObject failed after ${maxAttempts} attempts`)
}

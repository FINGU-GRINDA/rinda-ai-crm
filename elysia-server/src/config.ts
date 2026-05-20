import { z } from "zod"

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

function parseOriginList(raw: string): string[] {
  const trimmed = raw.trim()
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed)
    if (!Array.isArray(parsed) || !parsed.every((v): v is string => typeof v === "string")) {
      throw new Error("FRONTEND_URLS JSON value must be an array of strings")
    }
    return parsed.map((url) => url.trim()).filter(Boolean)
  }
  return trimmed
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
}

export const NODE_ENV = getEnvOrDefault("NODE_ENV", "development") as
  | "development"
  | "production"
  | "test"
export const isDevelopment = NODE_ENV === "development"
export const isProduction = NODE_ENV === "production"
export const isTest = NODE_ENV === "test"

const configSchema = z.object({
  // Database — single source of truth, parsed by pg / drizzle.
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/postgres"),
  DB_POOL_MIN: z.coerce.number().default(2), // Default: 2
  DB_POOL_MAX: z.coerce.number().default(10), // Default: 10

  // Server
  PORT: z.coerce.number().default(3001),
  // CORS allowlist. Accepts either format:
  //   - JSON array: ["https://a.com","https://b.com"]
  //   - Comma-separated: https://a.com,https://b.com
  // First entry is also used as the OAuth redirect origin.
  FRONTEND_URLS: z
    .string()
    .default("http://localhost:3000")
    .transform((val) => parseOriginList(val)),

  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),

  // Slack
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  CS_CHANNEL_ID: z.string().optional(),
  SALES_CHANNEL_ID: z.string().optional(),
  MEETING_NOTES_CHANNEL_ID: z.string().optional(),
  OPENCLAW_BOT_USER_ID: z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Authentication
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),

  // BullMQ / Redis — required. Fail-fast on missing config rather than
  // silently defaulting to localhost (would mask prod misconfig).
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // Anthropic (Stage Classifier). Optional in slice 1: ingestion still works
  // without it, classifier skips and no Deals materialize.
  ANTHROPIC_API_KEY: z.string().optional(),

  // Unipile (deferred to slice 2 — placeholders only).
  UNIPILE_API_KEY: z.string().optional(),
  UNIPILE_WEBHOOK_SECRET: z.string().optional(),

  // Bumping this forces the reclassify-on-deploy hook to re-blast LLM cost.
  CRM_RECLASSIFY_VERSION: z.string().default("0"),

  LOGGING_LEVEL: z.string().default(isProduction ? "info" : "debug"),
})

export type Config = z.infer<typeof configSchema>

function loadConfig(): Config {
  const parsed = configSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment variables")
  }
  console.log("FRONTEND URLS ", parsed.data.FRONTEND_URLS)

  return parsed.data
}

export const config = loadConfig()

// Helper: Get primary frontend URL (first in list) for OAuth redirects
export const primaryFrontendUrl = config.FRONTEND_URLS[0]

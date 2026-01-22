import { z } from "zod"

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

export const NODE_ENV = getEnvOrDefault("NODE_ENV", "development") as
  | "development"
  | "production"
  | "test"
export const isDevelopment = NODE_ENV === "development"
export const isProduction = NODE_ENV === "production"
export const isTest = NODE_ENV === "test"

const configSchema = z.object({
  // Database
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/postgres"),
  DB_POOL_MIN: z.coerce.number().default(2), // Default: 2
  DB_POOL_MAX: z.coerce.number().default(10), // Default: 10
  DB_HOST: z.string().default("localhost"), // Default: localhost
  DB_PORT: z.coerce.number().default(5432), // Default: 5432
  DB_USER: z.string().default("postgres"), // Default: postgres
  DB_PASSWORD: z.string().default("postgres"), // Default: postgres
  DB_NAME: z.string().default("postgres"), // Default: postgres

  // Server
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),

  // Slack
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  CS_CHANNEL_ID: z.string().optional(),
  SALES_CHANNEL_ID: z.string().optional(),
  MEETING_NOTES_CHANNEL_ID: z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Authentication
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),

  // Mixpanel
  MIXPANEL_PROJECT_ID: z.string().optional(),
  MIXPANEL_PROJECT_SECRET: z.string().optional(),

  LOGGING_LEVEL: z.string().default(isProduction ? "info" : "debug"),
})

export type Config = z.infer<typeof configSchema>

function loadConfig(): Config {
  const parsed = configSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment variables")
  }

  return parsed.data
}

export const config = loadConfig()

import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { config } from "./config"
import { runMigrations, waitForDatabase } from "./db/bootstrap"
import { drainInFlight } from "./lib/job-runner"
import { errorHandler } from "./middleware/error-handler"
import { loggerMiddleware } from "./middleware/logger"
import { settingsRepository } from "./repositories"
import { routes } from "./routes"
import { resumeRunningBackfills } from "./services/crm/email-backfill.service"
import { runReclassifyOnDeploy } from "./services/crm/reclassify-on-deploy.service"
import { logger } from "./utils/logger"
import { success } from "./utils/response"

const SHUTDOWN_DRAIN_TIMEOUT_MS = 30_000

async function main() {
  // Wait for the database to accept connections, then run migrations.
  // Replaces the `pg_isready` loop + smart-migrate.sh that used to run in
  // the Docker entrypoint.
  await waitForDatabase()
  await runMigrations()

  // Initialize default settings
  await settingsRepository.initializeDefaults()

  const _app = new Elysia()
    // CORS - supports multiple frontend URLs
    .use(
      cors({
        origin: config.FRONTEND_URLS,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Slack-Request-Timestamp",
          "X-Slack-Signature",
        ],
      }),
    )

    // Swagger documentation
    .use(
      swagger({
        documentation: {
          info: {
            title: "RINDA CRM API",
            version: "2.0.0",
            description: "TypeScript/Elysia/PostgreSQL Backend API",
          },
          tags: [
            { name: "Customers", description: "Customer management" },
            { name: "Prospects", description: "Prospect management" },
            { name: "Contacts", description: "Contact management" },
            { name: "Meetings", description: "Meeting management" },
            { name: "Notifications", description: "Notification management" },
            { name: "Settings", description: "Application settings" },
            { name: "AI", description: "AI-powered features" },
            { name: "Slack", description: "Slack integration" },
            { name: "Gmail", description: "Gmail integration" },
            { name: "Calendar", description: "Calendar integration" },
          ],
        },
      }),
    )

    // Middleware
    .use(loggerMiddleware)
    .use(errorHandler)

    // Health check
    .get("/health", () =>
      success({
        status: "ok",
        timestamp: Date.now(),
        version: "2.0.0",
        database: "connected",
      }),
    )

    // API routes
    .use(routes)

    // Start server
    .listen(config.PORT)

  logger.info(`🚀 RINDA CRM API server running at http://localhost:${config.PORT}`)
  logger.info(`📚 Swagger documentation available at http://localhost:${config.PORT}/swagger`)

  // CRM background work — runs in-process via fire-and-forget promises
  // tracked by job-runner. Shutdown drains the in-flight set with a timeout.
  void resumeRunningBackfills()
    .then((result) => logger.info(result, "[crm] resumeRunningBackfills complete"))
    .catch((err) => logger.error({ err }, "[crm] resumeRunningBackfills failed"))
  void runReclassifyOnDeploy()
    .then((result) => logger.info(result, "[crm] runReclassifyOnDeploy complete"))
    .catch((err) => logger.error({ err }, "[crm] runReclassifyOnDeploy failed"))

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "[server] Shutting down — draining in-flight CRM tasks")
    await drainInFlight({ timeoutMs: SHUTDOWN_DRAIN_TIMEOUT_MS })
    process.exit(0)
  }
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM")
  })
  process.on("SIGINT", () => {
    void shutdown("SIGINT")
  })
}

main().catch((error) => {
  logger.error("Failed to start server:", error)
  process.exit(1)
})

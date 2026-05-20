import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { config } from "./config"
import { runMigrations, waitForDatabase } from "./db/bootstrap"
import { closeCrmQueues } from "./lib/queue/queues"
import { closeRedisConnections } from "./lib/redis/connection"
import { errorHandler } from "./middleware/error-handler"
import { loggerMiddleware } from "./middleware/logger"
import { settingsRepository } from "./repositories"
import { routes } from "./routes"
import { runReclassifyOnDeploy } from "./services/crm/reclassify-on-deploy.service"
import { logger } from "./utils/logger"
import { success } from "./utils/response"
import {
  startCrmEmailBackfillWorker,
  stopCrmEmailBackfillWorker,
} from "./workers/bullmq/crm-email-backfill.worker"
import {
  startCrmStageClassifyWorker,
  stopCrmStageClassifyWorker,
} from "./workers/bullmq/crm-stage-classify.worker"

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

  // CRM BullMQ consumers — run in-process. Reclassify-on-deploy fires once
  // after the workers are up so its enqueues land on draining queues.
  const stoppers: Array<() => Promise<void>> = []
  if (startCrmEmailBackfillWorker()) stoppers.push(stopCrmEmailBackfillWorker)
  const classifyWorker = startCrmStageClassifyWorker()
  if (classifyWorker) {
    stoppers.push(stopCrmStageClassifyWorker)
    // Only seed reclassify jobs when there's a consumer — otherwise the queue
    // accumulates work no one will drain (Redis unreachable at boot etc).
    void runReclassifyOnDeploy()
      .then((result) => logger.info(result, "[crm] runReclassifyOnDeploy complete"))
      .catch((err) => logger.error({ err }, "[crm] runReclassifyOnDeploy failed"))
  } else {
    logger.warn("[crm] Stage-classifier worker failed to start — skipping reclassify-on-deploy")
  }

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "[server] Shutting down")
    await Promise.allSettled(stoppers.map((stop) => stop()))
    await closeCrmQueues()
    await closeRedisConnections()
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

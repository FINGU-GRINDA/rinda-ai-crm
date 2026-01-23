import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { config } from "./config"
import { testConnection } from "./db"
import { errorHandler } from "./middleware/error-handler"
import { loggerMiddleware } from "./middleware/logger"
import { settingsRepository } from "./repositories"
import { routes } from "./routes"
import { logger } from "./utils/logger"
import { success } from "./utils/response"

async function main() {
  // Test database connection
  const dbConnected = await testConnection()
  if (!dbConnected) {
    logger.error("Failed to connect to database. Exiting...")
    process.exit(1)
  }

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
            { name: "Mixpanel", description: "Mixpanel integration" },
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
}

main().catch((error) => {
  logger.error("Failed to start server:", error)
  process.exit(1)
})

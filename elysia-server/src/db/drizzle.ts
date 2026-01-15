import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { config, isDevelopment } from "../config"
import logger from "../utils/logger"
import * as schema from "./schema"

// Create connection pool with optimized settings
const pool = new Pool({
  connectionString: config.DATABASE_URL,

  // Pool size
  min: config.DB_POOL_MIN, // Minimum connections (default: 2)
  max: config.DB_POOL_MAX, // Maximum connections (default: 10)

  // Timeout settings
  idleTimeoutMillis: 60000, // Close idle connections after 60s
  connectionTimeoutMillis: 10000, // Fail if connection takes > 10s

  // TCP Keepalive - prevents connection drops by NAT/firewall
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s idle

  // Prevent app exit while pool has connections
  allowExitOnIdle: false,

  // UTF-8 encoding for multi-language support
  options: "-c client_encoding=UTF8",
})

// Monitor pool errors (always log errors)
pool.on("error", (err) => {
  logger.error({ err }, "PostgreSQL pool error")
})

// Only log connection events in development with TRACE level
if (isDevelopment && process.env.LOG_LEVEL === "trace") {
  pool.on("connect", () => {
    logger.trace("New database connection established")
  })

  pool.on("remove", () => {
    logger.trace("Database connection removed from pool")
  })
}

// Export drizzle instance with schema
export const db = drizzle(pool, { schema })

// Export pool for direct access if needed (e.g., for health checks)
export { pool }

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect()
    try {
      await client.query("SELECT 1")
      logger.info("Database connection successful")
      return true
    } finally {
      client.release()
    }
  } catch (err) {
    logger.error({ err }, "Failed to connect to database")
    return false
  }
}

import Redis from "ioredis"
import { config } from "../../config"
import logger from "../../utils/logger"

const MAX_RETRY_DELAY_MS = 30_000

// When Redis replies LOADING (dataset being loaded after restart), reconnect AND
// resend the pending command. Returning `2` makes ioredis re-queue on the new
// connection so BullMQ workers don't see the transient error.
const reconnectOnLoading = (err: Error) => (err.message?.includes("LOADING") ? 2 : false)

function buildOptions() {
  // BullMQ requires `maxRetriesPerRequest: null`.
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    reconnectOnError: reconnectOnLoading,
    retryStrategy(times: number) {
      const delay = Math.min(times * 1000, MAX_RETRY_DELAY_MS)
      logger.warn({ attempt: times, delayMs: delay }, "[Redis] Retry")
      return delay
    },
  } as const
}

export const redisConnection = new Redis(config.REDIS_URL, buildOptions())

redisConnection.on("connect", () => {
  logger.info("[Redis] Connected")
})

redisConnection.on("error", (err) => {
  if (err.message?.includes("ECONNREFUSED")) {
    logger.warn({ message: err.message }, "[Redis] Connection refused — Redis may not be running")
  } else {
    logger.error({ err }, "[Redis] Connection error")
  }
})

// BullMQ workers need their own connection — don't share with the singleton.
export function createRedisConnection(): Redis {
  const connection = new Redis(config.REDIS_URL, buildOptions())
  connection.on("error", (err) => {
    if (err.message?.includes("ECONNREFUSED")) {
      logger.warn({ message: err.message }, "[Redis] Worker connection refused")
    } else {
      logger.error({ err }, "[Redis] Worker connection error")
    }
  })
  return connection
}

export async function closeRedisConnections(): Promise<void> {
  await redisConnection.quit()
  logger.info("[Redis] Connections closed")
}

export default redisConnection

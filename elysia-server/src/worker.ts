/**
 * Worker process entry — runs BullMQ workers separate from the API process.
 *
 * Each phase registers its workers below. Slice 1 phases:
 *   - Phase 2: crmEmailBackfillWorker
 *   - Phase 3: crmStageClassifyWorker + reclassify-on-deploy hook
 *
 * `bun run dev` in package.json runs the API and this worker concurrently.
 */

import { closeCrmQueues } from "./lib/queue/queues"
import { closeRedisConnections } from "./lib/redis/connection"
import logger from "./utils/logger"

const workers: Array<{ close: () => Promise<void> }> = []

// Phase 2 / Phase 3 will register workers here. Importing the modules side-
// effectfully starts the workers. Wrapped in dynamic imports so missing
// modules during incremental builds don't break the entry.

// async function registerWorkers() {
//   const { crmEmailBackfillWorker } = await import("./workers/bullmq/crm-email-backfill.worker")
//   const { crmStageClassifyWorker } = await import("./workers/bullmq/crm-stage-classify.worker")
//   workers.push(crmEmailBackfillWorker, crmStageClassifyWorker)
// }

async function main(): Promise<void> {
  logger.info("[worker] Booting BullMQ worker process")
  // await registerWorkers()
  logger.info({ workerCount: workers.length }, "[worker] Workers registered, awaiting jobs")
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "[worker] Shutting down")
  await Promise.allSettled(workers.map((w) => w.close()))
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

main().catch((err) => {
  logger.fatal({ err }, "[worker] Boot failed")
  process.exit(1)
})

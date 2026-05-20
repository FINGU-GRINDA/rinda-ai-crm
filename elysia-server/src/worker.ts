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
import {
  startCrmEmailBackfillWorker,
  stopCrmEmailBackfillWorker,
} from "./workers/bullmq/crm-email-backfill.worker"

const stoppers: Array<() => Promise<void>> = []

async function main(): Promise<void> {
  logger.info("[worker] Booting BullMQ worker process")

  // Phase 2 — email backfill worker.
  const backfillWorker = startCrmEmailBackfillWorker()
  if (backfillWorker) stoppers.push(stopCrmEmailBackfillWorker)

  // Phase 3 will register the stage-classifier worker here.

  logger.info({ workerCount: stoppers.length }, "[worker] Workers registered, awaiting jobs")
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "[worker] Shutting down")
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

main().catch((err) => {
  logger.fatal({ err }, "[worker] Boot failed")
  process.exit(1)
})

/**
 * In-process job runner — replaces BullMQ for slice 1.
 *
 * - `Semaphore` caps concurrent async work without an external queue
 * - `fireAndForget` registers a background promise in `inFlight` so SIGTERM
 *   can drain it on shutdown
 * - `drainInFlight` awaits all tracked promises with a hard timeout
 *
 * No persistence, no retry, no cross-process dedup. Per-feature durability
 * comes from existing DB state (e.g. `crm_backfill_progress.cursor`) — see
 * the slice 1 plan, Part IV.
 */

import logger from "../utils/logger"

export class Semaphore {
  private permits: number
  private queue: Array<() => void> = []

  constructor(maxConcurrent: number) {
    if (maxConcurrent < 1) throw new Error("Semaphore maxConcurrent must be >= 1")
    this.permits = maxConcurrent
  }

  private async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits -= 1
      return
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  private release(): void {
    const next = this.queue.shift()
    if (next) {
      // Hand the permit straight to the next waiter — keeps the counter accurate
      // without a transient 0→1→0 dip.
      next()
    } else {
      this.permits += 1
    }
  }

  /** Run `fn` once a permit is available; always releases, even on throw. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}

const inFlight: Set<Promise<unknown>> = new Set()

/**
 * Track a background promise so `drainInFlight` can wait for it on shutdown.
 * Errors are caught + logged so a single rejection can't kill the process.
 */
export function fireAndForget(promise: Promise<unknown>, label: string): void {
  const wrapped = promise.catch((err) => {
    logger.error({ err, label }, "[job-runner] Background task failed")
  })
  inFlight.add(wrapped)
  wrapped.finally(() => {
    inFlight.delete(wrapped)
  })
}

/** Snapshot of currently-tracked background task count. */
export function inFlightCount(): number {
  return inFlight.size
}

/**
 * Await every in-flight promise, capped by `timeoutMs`. Promises still
 * running after the timeout are abandoned — their next manual re-trigger or
 * the per-feature recovery path (e.g. `resumeRunningBackfills`) picks them up.
 */
export async function drainInFlight({ timeoutMs }: { timeoutMs: number }): Promise<void> {
  if (inFlight.size === 0) return
  logger.info({ count: inFlight.size, timeoutMs }, "[job-runner] Draining in-flight tasks")
  const settled = Promise.allSettled([...inFlight])
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs)
  })
  const result = await Promise.race([settled.then(() => "drained" as const), timeout])
  if (timer) clearTimeout(timer)
  logger.info({ count: inFlight.size, result }, "[job-runner] Drain finished")
}

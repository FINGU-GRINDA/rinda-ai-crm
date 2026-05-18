import { readFileSync } from "node:fs"
import { join } from "node:path"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import logger from "../utils/logger"
import { db, pool } from "./drizzle"

type Journal = {
  entries: Array<{ idx: number; when: number; tag: string; breakpoints: boolean }>
}

const MIGRATIONS_DIR = join(process.cwd(), "drizzle")
const JOURNAL_PATH = join(MIGRATIONS_DIR, "meta", "_journal.json")

// Must mirror drizzle.config.ts → migrations.{table,schema}.
const MIGRATIONS_TABLE = "__drizzle_migrations"
const MIGRATIONS_SCHEMA = "public"

/**
 * Poll the database until it accepts a `SELECT 1` query.
 * Replaces the `pg_isready` shell loop that used to live in the Dockerfile CMD.
 */
export async function waitForDatabase(opts?: {
  maxAttempts?: number
  delayMs?: number
}): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 60
  const delayMs = opts?.delayMs ?? 2000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect()
      try {
        await client.query("SELECT 1")
        logger.info({ attempt }, "Database is reachable")
        return
      } finally {
        client.release()
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        logger.error({ err, attempt }, "Database never became reachable")
        throw err
      }
      logger.warn({ attempt, maxAttempts }, `Database not ready, retrying in ${delayMs}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/**
 * Run drizzle migrations, with the same "adoption" behavior the old
 * `smart-migrate.sh` provided: if a populated schema exists without a
 * `__drizzle_migrations` table, seed the tracking table from `_journal.json`
 * so drizzle does not try to re-create existing tables.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect()
  try {
    const tracking = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      [MIGRATIONS_SCHEMA, MIGRATIONS_TABLE],
    )
    const trackingExists = tracking.rows[0]?.exists ?? false

    if (!trackingExists) {
      const coreTables = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN ('slack', 'contacts')`,
      )
      const hasExistingSchema = Number(coreTables.rows[0]?.count ?? "0") > 0

      if (hasExistingSchema) {
        logger.warn(
          "Existing schema detected without migration tracking — initializing history from _journal.json",
        )
        await adoptExistingSchema(client)
        logger.info("Migration history initialized; schema considered in-sync")
        return
      }
    }
  } finally {
    client.release()
  }

  logger.info("Running drizzle migrations...")
  await migrate(db, {
    migrationsFolder: MIGRATIONS_DIR,
    migrationsTable: MIGRATIONS_TABLE,
    migrationsSchema: MIGRATIONS_SCHEMA,
  })
  logger.info("Migrations completed")
}

async function adoptExistingSchema(client: {
  query: (text: string, values?: unknown[]) => Promise<unknown>
}): Promise<void> {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf-8")) as Journal

  const qualified = `${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`

  await client.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`)
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${qualified} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)

  for (const entry of journal.entries) {
    await client.query(
      `INSERT INTO ${qualified} (hash, created_at)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [entry.tag, entry.when],
    )
  }
}

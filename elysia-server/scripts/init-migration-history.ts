#!/usr/bin/env bun
/**
 * Initialize migration history for existing database schemas
 * Reads all migrations from _journal.json and marks them as applied
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import pg from "pg"

const { Pool } = pg

// Database configuration from environment
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "postgres",
})

async function initMigrationHistory() {
  try {
    // Read _journal.json
    const journalPath = join(import.meta.dir, "../drizzle/meta/_journal.json")
    const journalData = JSON.parse(readFileSync(journalPath, "utf-8"))

    console.log(`[+] Found ${journalData.entries.length} migrations in _journal.json`)

    // Create migration table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `)

    // Insert all migrations
    let inserted = 0
    for (const entry of journalData.entries) {
      const result = await pool.query(
        `INSERT INTO __drizzle_migrations (hash, created_at) 
         VALUES ($1, $2) 
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [entry.tag, entry.when],
      )
      if (result.rowCount && result.rowCount > 0) {
        inserted++
      }
    }

    console.log(`[+] Inserted ${inserted} new migration records`)
    console.log(`[+] Migration history initialized successfully`)

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error("[!] Error initializing migration history:", error)
    await pool.end()
    process.exit(1)
  }
}

initMigrationHistory()

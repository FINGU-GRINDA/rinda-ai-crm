#!/usr/bin/env bun

/**
 * Update Slack User Names Script
 *
 * Fetches all slack_messages rows with a userId, then updates userName
 * by fetching the real name from Slack API.
 *
 * Usage:
 *   bun run scripts/update-slack-usernames.ts
 *   bun run scripts/update-slack-usernames.ts --dry-run
 *   bun run scripts/update-slack-usernames.ts --limit 100
 */

import { eq, isNotNull } from "drizzle-orm"
import { parseArgs } from "util"
import { db } from "../src/db"
import { slackMessages } from "../src/db/schema"
import { slackApiService } from "../src/services/slack-api.service"
import { logger } from "../src/utils/logger"

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "dry-run": { type: "boolean", short: "d" },
    limit: { type: "string", short: "l" },
    help: { type: "boolean", short: "h" },
  },
  strict: true,
})

function printUsage() {
  console.log(`
Update Slack User Names Script

Fetches all slack_messages with a userId and updates userName
by fetching the real name from Slack API.

Usage:
  bun run scripts/update-slack-usernames.ts [options]

Options:
  -d, --dry-run        Preview without updating
  -l, --limit <n>      Maximum records to process
  -h, --help           Show this help message

Examples:
  # Update all messages
  bun run scripts/update-slack-usernames.ts

  # Preview what would be updated
  bun run scripts/update-slack-usernames.ts --dry-run

  # Update with limit
  bun run scripts/update-slack-usernames.ts --limit 50
`)
}

async function main() {
  if (values.help) {
    printUsage()
    process.exit(0)
  }

  const dryRun = values["dry-run"] ?? false
  const limit = values.limit ? parseInt(values.limit, 10) : undefined

  console.log("\n=== Update Slack User Names ===\n")
  console.log(`Dry Run: ${dryRun ? "Yes" : "No"}`)
  console.log(`Limit:   ${limit || "None"}`)
  console.log("")

  try {
    // Fetch all messages with a userId (select only id and userId)
    const query = db
      .select({
        id: slackMessages.id,
        userId: slackMessages.userId,
      })
      .from(slackMessages)
      .where(isNotNull(slackMessages.userId))
      .orderBy(slackMessages.receivedAt)

    const messages = limit ? await query.limit(limit) : await query

    console.log(`Found ${messages.length} messages with userId\n`)

    if (messages.length === 0) {
      console.log("No messages to update.")
      process.exit(0)
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(messages.map((m) => m.userId).filter(Boolean))] as string[]
    console.log(`Unique user IDs: ${uniqueUserIds.length}`)

    // Fetch real names from Slack API
    const userNameMap = new Map<string, string>()
    let fetchedCount = 0
    let failedCount = 0

    console.log("\nFetching user info from Slack API...\n")

    for (const userId of uniqueUserIds) {
      try {
        const userInfo = await slackApiService.getUserInfo(userId)
        if (userInfo) {
          const realName = userInfo.realName || userInfo.name || userId
          userNameMap.set(userId, realName)
          console.log(`  [OK] ${userId} → ${realName}`)
          fetchedCount++
        } else {
          console.log(`  [SKIP] ${userId} → No user info returned`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.log(`  [FAIL] ${userId} → ${errorMsg}`)
        failedCount++
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log(`\nFetched: ${fetchedCount}, Failed: ${failedCount}\n`)

    if (userNameMap.size === 0) {
      console.log("No user names to update (could not fetch any from Slack API).")
      console.log("Make sure your Slack bot has the 'users:read' scope.")
      process.exit(1)
    }

    // Update messages by row id
    let updatedCount = 0
    let skippedCount = 0

    if (dryRun) {
      console.log("=== Dry Run Preview ===\n")
      for (const msg of messages) {
        if (msg.userId && userNameMap.has(msg.userId)) {
          const newName = userNameMap.get(msg.userId)
          console.log(`  [${msg.id}] Would update userName → ${newName}`)
          updatedCount++
        } else {
          skippedCount++
        }
      }
    } else {
      console.log("Updating database...\n")
      for (const msg of messages) {
        if (msg.userId && userNameMap.has(msg.userId)) {
          const newName = userNameMap.get(msg.userId)!
          await db
            .update(slackMessages)
            .set({ userName: newName })
            .where(eq(slackMessages.id, msg.id))
          console.log(`  [${msg.id}] Updated userName → ${newName}`)
          updatedCount++
        } else {
          skippedCount++
        }
      }
    }

    console.log("\n=== Results ===\n")
    console.log(`Total messages:  ${messages.length}`)
    console.log(`Updated:         ${updatedCount}`)
    console.log(`Skipped:         ${skippedCount}`)

    if (dryRun) {
      console.log("\n(Dry run - no changes made)")
    }

    console.log("")
    process.exit(0)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`\nError: ${errorMsg}\n`)
    logger.error({ error: errorMsg }, "Failed to update slack usernames")
    process.exit(1)
  }
}

main()

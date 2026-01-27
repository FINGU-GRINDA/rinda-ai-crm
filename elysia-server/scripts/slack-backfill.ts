#!/usr/bin/env bun
/**
 * Slack Message Backfill CLI Script
 *
 * Fetches historical messages from Slack channels and processes them
 * through the existing channel handlers (CS, Sales, Meeting Notes).
 *
 * Usage:
 *   bun run scripts/slack-backfill.ts --channel cs --start 2024-01-01
 *   bun run scripts/slack-backfill.ts --channel-id C123456 --start 2024-01-01 --end 2024-01-31
 *   bun run scripts/slack-backfill.ts --channel meeting-notes --start 2024-01-01 --dry-run
 *   bun run scripts/slack-backfill.ts --channel sales --start 2024-01-01 --dry-run
 *   bun run scripts/slack-backfill.ts --channel cs --start 2024-01-01 --limit 100
 */

import { parseArgs } from "util"
import { slackBackfillService } from "../src/services/slack-backfill.service"

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    channel: { type: "string", short: "c" },
    "channel-id": { type: "string" },
    start: { type: "string", short: "s" },
    end: { type: "string", short: "e" },
    limit: { type: "string", short: "l" },
    "dry-run": { type: "boolean", short: "d" },
    "batch-size": { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  strict: true,
})

function printUsage() {
  console.log(`
Slack Message Backfill Script

Fetches historical messages from Slack channels and processes them through
the existing channel handlers (CS inquiries, Sales updates, Meeting notes).

Usage:
  bun run scripts/slack-backfill.ts [options]

Options:
  -c, --channel <type>     Channel type: cs, sales, or meeting-notes
  --channel-id <id>        Direct Slack channel ID (alternative to --channel)
  -s, --start <date>       Start date (required, format: YYYY-MM-DD)
  -e, --end <date>         End date (optional, defaults to now)
  -l, --limit <number>     Maximum messages to process
  -d, --dry-run            Preview without processing
  --batch-size <number>    Messages per Slack API call (default: 100)
  -h, --help               Show this help message

Examples:
  # Backfill CS channel from January 1, 2024
  bun run scripts/slack-backfill.ts --channel cs --start 2024-01-01

  # Dry run to preview what would be backfilled
  bun run scripts/slack-backfill.ts --channel meeting-notes --start 2024-01-01 --dry-run

  # Backfill with date range and limit
  bun run scripts/slack-backfill.ts --channel sales --start 2024-01-01 --end 2024-01-31 --limit 500

  # Backfill using direct channel ID
  bun run scripts/slack-backfill.ts --channel-id C0123456789 --start 2024-01-01
`)
}

async function main() {
  if (values.help) {
    printUsage()
    process.exit(0)
  }

  // Validate required arguments
  if (!values.start) {
    console.error("Error: --start date is required\n")
    printUsage()
    process.exit(1)
  }

  if (!values.channel && !values["channel-id"]) {
    console.error("Error: Either --channel or --channel-id is required\n")
    printUsage()
    process.exit(1)
  }

  // Parse dates
  const startDate = new Date(values.start)
  if (isNaN(startDate.getTime())) {
    console.error("Error: Invalid start date format. Use YYYY-MM-DD\n")
    process.exit(1)
  }

  const endDate = values.end ? new Date(values.end) : undefined
  if (endDate && isNaN(endDate.getTime())) {
    console.error("Error: Invalid end date format. Use YYYY-MM-DD\n")
    process.exit(1)
  }

  // Display configuration
  console.log("\n=== Slack Message Backfill ===\n")
  console.log(`Channel:    ${values.channel || values["channel-id"]}`)
  console.log(`Start Date: ${startDate.toISOString().split("T")[0]}`)
  console.log(`End Date:   ${endDate ? endDate.toISOString().split("T")[0] : "Now"}`)
  console.log(`Limit:      ${values.limit || "None"}`)
  console.log(`Dry Run:    ${values["dry-run"] ? "Yes" : "No"}`)
  console.log("")

  try {
    const result = await slackBackfillService.backfill(
      {
        channelType: values.channel as "cs" | "sales" | "meeting-notes" | undefined,
        channelId: values["channel-id"],
        startDate,
        endDate,
        limit: values.limit ? parseInt(values.limit, 10) : undefined,
        dryRun: values["dry-run"],
        batchSize: values["batch-size"] ? parseInt(values["batch-size"], 10) : undefined,
      },
      (progress) => {
        // Progress indicator - overwrite same line
        process.stdout.write(`\r[${progress.phase}] ${progress.message}`)
      },
    )

    // Clear progress line and show results
    console.log("\n\n=== Results ===\n")
    console.log(`Total Fetched:   ${result.totalFetched}`)
    console.log(`Total Processed: ${result.totalProcessed}`)
    console.log(`Total Skipped:   ${result.totalSkipped}`)
    console.log(`Total Errors:    ${result.totalErrors}`)
    console.log(`Duration:        ${(result.durationMs / 1000).toFixed(2)}s`)

    // Show dry run preview
    if (result.dryRunMessages && result.dryRunMessages.length > 0) {
      console.log("\n=== Preview (Dry Run) ===\n")

      const wouldProcess = result.dryRunMessages.filter((m) => m.wouldProcess)
      const wouldSkip = result.dryRunMessages.filter((m) => !m.wouldProcess)

      console.log(`Would process: ${wouldProcess.length}`)
      console.log(`Would skip:    ${wouldSkip.length}\n`)

      // Show first 10 messages that would be processed
      if (wouldProcess.length > 0) {
        console.log("Messages to process (first 10):")
        for (const msg of wouldProcess.slice(0, 10)) {
          console.log(`  [NEW] ${msg.slackTs} - ${msg.text}`)
        }
        if (wouldProcess.length > 10) {
          console.log(`  ... and ${wouldProcess.length - 10} more`)
        }
      }

      // Show first 5 messages that would be skipped
      if (wouldSkip.length > 0) {
        console.log("\nMessages to skip (first 5):")
        for (const msg of wouldSkip.slice(0, 5)) {
          console.log(`  [SKIP] ${msg.slackTs} - ${msg.text}`)
        }
        if (wouldSkip.length > 5) {
          console.log(`  ... and ${wouldSkip.length - 5} more`)
        }
      }
    }

    // Show errors if any
    if (result.errors.length > 0) {
      console.log("\n=== Errors ===\n")
      for (const err of result.errors.slice(0, 10)) {
        console.log(`  ${err.slackTs}: ${err.error}`)
      }
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more errors`)
      }
    }

    console.log("")
    process.exit(result.totalErrors > 0 ? 1 : 0)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`\nBackfill failed: ${errorMsg}\n`)
    process.exit(1)
  }
}

main()

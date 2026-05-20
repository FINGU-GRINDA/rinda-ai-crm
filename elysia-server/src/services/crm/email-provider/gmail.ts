/**
 * Gmail EmailProvider — slice 1 implementation.
 *
 * Reuses the existing `gmailService.getClient()` OAuth2Client; metadata-only
 * `messages.get(format=metadata)` for cost (no body fetch). Slice 1 still
 * uses the SYSTEM_USER_ID shared-token pattern from gmail.service.ts (known
 * smell flagged in the architecture review); per-workspace tokens move to
 * crm_email_connections in slice 2.
 */

import { type gmail_v1, google } from "googleapis"
import logger from "../../../utils/logger"
import { gmailService } from "../../gmail.service"
import type { EmailProvider, ListPageArgs, ListPageResult, MailboxEmail } from "./types"

const HEADER_NAMES = ["From", "To", "Cc", "Subject", "Date"] as const

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
}

function splitAddresses(raw: string | undefined): Array<{ identifier?: string }> {
  if (!raw) return []
  // Naive split on commas — good enough for the ingestion path's `normalizeEmail`
  // which extracts the `<...>` form. RFC 5322 group syntax is rare in practice.
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((identifier) => ({ identifier }))
}

function isoFromGmailDate(
  headerDate: string | undefined,
  internalDateMs: string | null | undefined,
): string {
  if (headerDate) {
    const parsed = new Date(headerDate)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  if (internalDateMs) {
    const n = Number.parseInt(internalDateMs, 10)
    if (!Number.isNaN(n)) return new Date(n).toISOString()
  }
  return new Date().toISOString()
}

function isoToGmailDate(iso: string): string {
  // Gmail's `after:` operator wants YYYY/MM/DD.
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}/${m}/${day}`
}

export class GmailEmailProvider implements EmailProvider {
  async listPage(args: ListPageArgs): Promise<ListPageResult> {
    const client = await gmailService.getClient()
    const gmail = google.gmail({ version: "v1", auth: client })

    // category:primary scopes to the Primary tab — reliable category filter,
    // unlike `-in:promotions` which Gmail does not document as a category op.
    const q = `after:${isoToGmailDate(args.after)} category:primary -in:spam`
    const maxResults = Math.min(args.limit ?? 100, 100)

    const listResp = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      pageToken: args.cursor,
      q,
    })

    const ids = (listResp.data.messages ?? [])
      .map((m) => m.id)
      .filter((v): v is string => Boolean(v))
    if (ids.length === 0) {
      return { items: [], cursor: listResp.data.nextPageToken ?? null }
    }

    // Metadata-only fetch per message — cheap enough for slice 1.
    const items: MailboxEmail[] = []
    for (const id of ids) {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: [...HEADER_NAMES],
        })
        const headers = msg.data.payload?.headers
        const from = headerValue(headers, "From")
        const to = headerValue(headers, "To")
        const cc = headerValue(headers, "Cc")
        const subject = headerValue(headers, "Subject")
        const dateHeader = headerValue(headers, "Date")
        items.push({
          id,
          threadId: msg.data.threadId ?? undefined,
          date: isoFromGmailDate(dateHeader, msg.data.internalDate),
          from: { identifier: from },
          to: splitAddresses(to),
          cc: splitAddresses(cc),
          subject,
        })
      } catch (err) {
        logger.warn({ id, err }, "[email-provider/gmail] messages.get failed")
      }
    }

    return { items, cursor: listResp.data.nextPageToken ?? null }
  }
}

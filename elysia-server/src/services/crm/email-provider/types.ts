/**
 * EmailProvider — provider-agnostic mailbox abstraction for CRM ingestion.
 *
 * Shape matches the source's `UnipileMailboxEmail` so the lifted backfill
 * service consumes the same DTO regardless of provider.
 */

export interface MailboxEmail {
  /** Provider-side message id. */
  id: string
  /** Provider-side thread id; absent for standalone messages. */
  threadId?: string
  /** ISO 8601 timestamp. */
  date: string
  from: { identifier?: string }
  to: Array<{ identifier?: string }>
  cc: Array<{ identifier?: string }>
  subject?: string
}

export interface ListPageArgs {
  /** Provider-specific account id (Gmail email address, Unipile account_id). */
  accountId: string
  /** ISO 8601 lower bound — only return messages newer than this. */
  after: string
  /** Opaque pagination cursor — null/undefined for first page. */
  cursor?: string
  /** Page size; provider may cap. */
  limit?: number
}

export interface ListPageResult {
  items: MailboxEmail[]
  /** Opaque next-page cursor; null when end of stream. */
  cursor: string | null
}

export interface EmailProvider {
  listPage(args: ListPageArgs): Promise<ListPageResult>
}

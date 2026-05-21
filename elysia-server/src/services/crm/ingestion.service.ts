/**
 * CRM Ingestion — write Account / Person / Contact / Message rows from a
 * CRM-domain message DTO. The DTO is provider-agnostic; callers (Gmail
 * backfill in slice 1, Unipile webhook handler in slice 2) translate their
 * provider-specific payloads into this shape.
 *
 * Slice A: no enrichment. Account fields beyond `(name, domain)` stay null;
 * Person fields beyond `full_name` stay null. Enrichment fills them later.
 *
 * Idempotent on `messages.external_message_id`. Race-safe via the partial-
 * unique on `crm_accounts(workspace_id, lower(domain))` and the unique on
 * `crm_contacts(workspace_id, kind, lower(value))` — concurrent ingests for
 * the same domain or same email produce one row each.
 *
 * Lifted verbatim from send-grid-test/elysia-server/src/services/crm/crm-ingestion.service.ts.
 */

import { and, eq, sql } from "drizzle-orm"
import { db } from "../../db"
import { accounts, contacts, persons } from "../../db/schema/crm-core"
import { messages } from "../../db/schema/crm-deals"
import { crmObjectEvents } from "../../db/schema/crm-events"
import { registrableDomain } from "../../utils/domain"

export type IngestMessageDto = {
  externalMessageId: string | null
  threadExternalId: string | null
  direction: "inbound" | "outbound"
  fromEmail: string
  toEmail: string
  ccEmails?: string[] | null
  subject?: string | null
  body?: string | null
  sentAt: Date
  openedAt?: Date | null
  clickedAt?: Date | null
  repliedAt?: Date | null
}

export type IngestEmailInput = {
  workspaceId: string
  message: IngestMessageDto
}

export type IngestEmailResult = {
  accountIds: string[]
  personIds: string[]
  contactIds: string[]
  /** null when the message was already ingested (idempotent skip). */
  messageId: string | null
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function normalizeEmail(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const angleMatch = trimmed.match(/<([^>]+)>/)
  const candidate = (angleMatch?.[1] ?? trimmed).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return null
  return candidate
}

function parseEmailAddress(email: string): { localPart: string; domain: string } | null {
  const value = normalizeEmail(email)
  if (!value) return null
  const at = value.lastIndexOf("@")
  const host = value.slice(at + 1)
  const domain = registrableDomain(host)
  if (!domain) return null
  return { localPart: value.slice(0, at), domain }
}

function titleCaseFromDomain(domain: string): string {
  const head = domain.split(".")[0] ?? domain
  if (!head) return domain
  return head.charAt(0).toUpperCase() + head.slice(1)
}

function extractBuyerEmails(message: IngestMessageDto): string[] {
  if (message.direction === "inbound") {
    const v = normalizeEmail(message.fromEmail)
    return v ? [v] : []
  }
  const recipients: string[] = []
  const to = normalizeEmail(message.toEmail)
  if (to) recipients.push(to)
  for (const cc of message.ccEmails ?? []) {
    const v = normalizeEmail(cc)
    if (v && !recipients.includes(v)) recipients.push(v)
  }
  return recipients
}

async function findAccountByDomain(tx: Tx, workspaceId: string, domain: string) {
  const rows = await tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.workspaceId, workspaceId), sql`lower(${accounts.domain}) = ${domain}`))
    .limit(1)
  return rows[0]?.id ?? null
}

async function findContactByEmail(tx: Tx, workspaceId: string, lowerEmail: string) {
  const rows = await tx
    .select({ id: contacts.id, personId: contacts.personId, sources: contacts.sources })
    .from(contacts)
    .where(
      and(
        eq(contacts.workspaceId, workspaceId),
        eq(contacts.kind, "email"),
        sql`lower(${contacts.value}) = ${lowerEmail}`,
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

/**
 * SELECT-then-INSERT inside a savepoint. If two ingests race on the same
 * domain, one wins the unique-violation lottery and the loser falls back to
 * re-reading the winner's row.
 */
async function upsertAccountByDomain(
  tx: Tx,
  workspaceId: string,
  domain: string,
): Promise<{ id: string; isNew: boolean }> {
  const existing = await findAccountByDomain(tx, workspaceId, domain)
  if (existing) return { id: existing, isNew: false }

  try {
    const inserted = await tx.transaction(async (sav) => {
      const rows = await sav
        .insert(accounts)
        .values({ workspaceId, name: titleCaseFromDomain(domain), domain })
        .returning({ id: accounts.id })
      return rows[0] ?? null
    })
    if (inserted) return { id: inserted.id, isNew: true }
  } catch {
    // unique violation — fall through to re-read
  }

  const winner = await findAccountByDomain(tx, workspaceId, domain)
  if (!winner)
    throw new Error(
      `upsertAccountByDomain: domain=${domain} insert lost race but row not found on re-read`,
    )
  return { id: winner, isNew: false }
}

async function createPersonAndContact(
  tx: Tx,
  args: {
    workspaceId: string
    accountId: string
    fullName: string
    lowerEmail: string
    sourceTag: string
  },
): Promise<{ contactId: string; personId: string; isNewPerson: boolean; isNewContact: boolean }> {
  const { workspaceId, accountId, fullName, lowerEmail, sourceTag } = args

  try {
    const inserted = await tx.transaction(async (sav) => {
      const personRows = await sav
        .insert(persons)
        .values({ workspaceId, accountId, fullName })
        .returning({ id: persons.id })
      const newPerson = personRows[0]
      if (!newPerson) return null

      const contactRows = await sav
        .insert(contacts)
        .values({
          workspaceId,
          personId: newPerson.id,
          kind: "email",
          value: lowerEmail,
          sources: [sourceTag],
        })
        .returning({ id: contacts.id })
      const newContact = contactRows[0]
      if (!newContact) return null

      return { personId: newPerson.id, contactId: newContact.id }
    })
    if (inserted) {
      return {
        contactId: inserted.contactId,
        personId: inserted.personId,
        isNewPerson: true,
        isNewContact: true,
      }
    }
  } catch {
    // unique violation on contact — fall through to re-read the winning contact
  }

  const winner = await findContactByEmail(tx, workspaceId, lowerEmail)
  if (!winner) {
    throw new Error(
      `createPersonAndContact: contact email=${lowerEmail} insert lost race but row not found on re-read`,
    )
  }
  return {
    contactId: winner.id,
    personId: winner.personId,
    isNewPerson: false,
    isNewContact: false,
  }
}

export async function ingestEmail(input: IngestEmailInput): Promise<IngestEmailResult> {
  const { workspaceId, message } = input
  const externalMessageId = message.externalMessageId
  const direction = message.direction

  const buyerEmails = extractBuyerEmails(message)
  if (buyerEmails.length === 0) {
    return { accountIds: [], personIds: [], contactIds: [], messageId: null }
  }

  // Engagement gate.
  const hasOwnEngagement =
    direction === "inbound" ||
    message.openedAt != null ||
    message.clickedAt != null ||
    message.repliedAt != null
  if (!hasOwnEngagement) {
    return { accountIds: [], personIds: [], contactIds: [], messageId: null }
  }
  if (direction === "inbound" && !message.threadExternalId) {
    return { accountIds: [], personIds: [], contactIds: [], messageId: null }
  }
  const threadExternalId = message.threadExternalId

  return await db.transaction(async (tx) => {
    // Prior-outbound gate (inbound only).
    if (direction === "inbound" && threadExternalId) {
      const [priorOutbound] = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, workspaceId),
            eq(messages.threadExternalId, threadExternalId),
            eq(messages.direction, "outbound"),
          ),
        )
        .limit(1)
      if (!priorOutbound) {
        return { accountIds: [], personIds: [], contactIds: [], messageId: null }
      }
    }

    // Idempotency.
    if (externalMessageId) {
      const existing = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, workspaceId),
            eq(messages.externalMessageId, externalMessageId),
          ),
        )
        .limit(1)
      if (existing.length > 0) {
        return { accountIds: [], personIds: [], contactIds: [], messageId: null }
      }
    }

    const accountIds: string[] = []
    const personIds: string[] = []
    const contactIds: string[] = []
    let primaryContactId: string | null = null
    const sourceTag = direction === "inbound" ? "inbound_email" : "outbound_email"

    for (let i = 0; i < buyerEmails.length; i++) {
      const email = buyerEmails[i]
      if (!email) continue
      const parsed = parseEmailAddress(email)
      if (!parsed) continue
      const { localPart, domain } = parsed

      const accountResult = await upsertAccountByDomain(tx, workspaceId, domain)
      if (!accountIds.includes(accountResult.id)) accountIds.push(accountResult.id)

      let contactId: string
      let personId: string
      let isNewPerson = false
      let isNewContact = false

      const existingContact = await findContactByEmail(tx, workspaceId, email)
      if (existingContact) {
        contactId = existingContact.id
        personId = existingContact.personId
        await tx
          .update(contacts)
          .set({
            sources: sql`CASE WHEN ${sourceTag} = ANY(${contacts.sources}) THEN ${contacts.sources} ELSE array_append(${contacts.sources}, ${sourceTag}) END`,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contactId))
      } else {
        const created = await createPersonAndContact(tx, {
          workspaceId,
          accountId: accountResult.id,
          fullName: localPart,
          lowerEmail: email,
          sourceTag,
        })
        contactId = created.contactId
        personId = created.personId
        isNewPerson = created.isNewPerson
        isNewContact = created.isNewContact
      }

      if (!personIds.includes(personId)) personIds.push(personId)
      if (!contactIds.includes(contactId)) contactIds.push(contactId)
      if (i === 0) primaryContactId = contactId

      const eventRows: Array<{
        eventType: "account_created" | "person_created" | "contact_added"
        targetType: "account" | "person" | "contact"
        targetId: string
      }> = []
      if (accountResult.isNew) {
        eventRows.push({
          eventType: "account_created",
          targetType: "account",
          targetId: accountResult.id,
        })
      }
      if (isNewPerson) {
        eventRows.push({ eventType: "person_created", targetType: "person", targetId: personId })
      }
      if (isNewContact) {
        eventRows.push({ eventType: "contact_added", targetType: "contact", targetId: contactId })
      }
      if (eventRows.length > 0) {
        await tx.insert(crmObjectEvents).values(
          eventRows.map((e) => ({
            workspaceId,
            eventType: e.eventType,
            targetType: e.targetType,
            targetId: e.targetId,
            sourceType: "unipile_webhook" as const,
          })),
        )
      }
    }

    if (!primaryContactId) {
      return { accountIds, personIds, contactIds, messageId: null }
    }

    const messageRows = await tx
      .insert(messages)
      .values({
        workspaceId,
        contactId: primaryContactId,
        channel: "email",
        direction,
        externalMessageId,
        threadExternalId: message.threadExternalId,
        subject: message.subject ?? null,
        body: message.body ?? "",
        sentAt: message.sentAt,
        openedAt: message.openedAt ?? null,
        clickedAt: message.clickedAt ?? null,
        repliedAt: message.repliedAt ?? null,
      })
      .returning({ id: messages.id })

    return {
      accountIds,
      personIds,
      contactIds,
      messageId: messageRows[0]?.id ?? null,
    }
  })
}

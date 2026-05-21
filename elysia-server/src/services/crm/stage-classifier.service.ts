/**
 * Stage Classifier — assigns one of the five pipeline stages to a thread by
 * running Claude Sonnet 4.6 against the thread's messages.
 *
 * Lifted from send-grid-test/elysia-server/src/services/crm/stage-classifier.service.ts.
 *
 * Per spec §3.1–3.5. The signal engine computes a deterministic FLOOR stage
 * from mechanical message signals; the LLM may PROMOTE above the floor based
 * on prose evidence — never demote. Threads with no signal return
 * `{ assignedStage: null, skipReason: "no_signals" }`.
 *
 * Read-only against the DB. The decision to materialize a `crm_deals` row
 * lives in `deal-materializer.service.ts` — keeping the LLM call free of
 * write side-effects makes it trivially safe to re-run on retry.
 */

import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../db"
import { accounts, contacts, persons } from "../../db/schema/crm-core"
import { type DealStage, dealStageEnum, messages } from "../../db/schema/crm-deals"
import { callAIObject } from "../../lib/ai-gateway/call"
import logger from "../../utils/logger"
import { listWorkspaceProducts } from "../workspace-product.service"
import { getAppliedWisdom } from "../workspace-wisdom.service"
import {
  clampToFloor,
  computeFloorStage,
  computeThreadSignals,
  type ThreadSignals,
} from "./signal-engine.service"

const MAX_MESSAGES_PER_THREAD = 40
const MAX_BODY_CHARS_PER_MESSAGE = 2000
const MAX_WISDOM_CHARS = 3000
const MAX_PRODUCTS_IN_PROMPT = 10
const MAX_PRODUCT_DESCRIPTION_CHARS = 400

const CLASSIFIER_MODEL = "claude-sonnet-4-6"
const CLASSIFIER_FEATURE = "crm-stage-classifier"

const LLM_MAX_ATTEMPTS = 2
const LLM_RETRY_BACKOFF_MS = 500

// ============================================================================
// Output shape
// ============================================================================

export interface ClassificationResult {
  assignedStage: DealStage
  confidenceScore: number
  detectedSignals: string[]
  rationaleText: string
  championPersonId: string | null
  accountId: string | null
  extractionJson: Record<string, unknown>
}

export type ClassifierSkipReason =
  | "no_messages"
  | "no_signals"
  | "not_outbound_initiated"
  | "no_account"
  | "not_about_business"
  | "classifier_error"

export interface ClassifierSkip {
  assignedStage: null
  skipReason: ClassifierSkipReason
  message: string
}

// ============================================================================
// LLM output schema
// ============================================================================

const llmOutputSchema = z.object({
  assigned_stage: z.enum(dealStageEnum.enumValues),
  confidence_score: z.number().min(0).max(1),
  detected_signals: z.array(z.string()).max(20),
  rationale_text: z.string().max(400),
  champion_email: z.string().nullable(),
  extraction_json: z.record(z.string(), z.unknown()),
  is_about_business: z.boolean(),
  business_relevance_reasoning: z.string().max(300),
})

type LlmOutput = z.infer<typeof llmOutputSchema>

// ============================================================================
// Public API
// ============================================================================

export interface ClassifyThreadParams {
  workspaceId: string
  threadExternalId: string
}

export async function classifyThread(
  params: ClassifyThreadParams,
): Promise<ClassificationResult | ClassifierSkip> {
  const { workspaceId, threadExternalId } = params

  // 1. Load thread messages chronologically.
  const threadRows = await db
    .select({
      id: messages.id,
      direction: messages.direction,
      subject: messages.subject,
      body: messages.body,
      sentAt: messages.sentAt,
      openedAt: messages.openedAt,
      clickedAt: messages.clickedAt,
      repliedAt: messages.repliedAt,
      contactId: messages.contactId,
    })
    .from(messages)
    .where(
      and(eq(messages.workspaceId, workspaceId), eq(messages.threadExternalId, threadExternalId)),
    )
    .orderBy(asc(messages.sentAt))

  if (threadRows.length === 0) {
    return {
      assignedStage: null,
      skipReason: "no_messages",
      message: `thread ${threadExternalId} has no messages in workspace ${workspaceId}`,
    }
  }

  // 2. Signal-engine gate.
  const signals = computeThreadSignals(threadRows)

  // 2a. Pipeline-eligibility gate — only materialize when we initiated.
  if (!signals.firstMessageIsOutbound) {
    return {
      assignedStage: null,
      skipReason: "not_outbound_initiated",
      message: `thread ${threadExternalId} did not start with our outbound (out=${signals.outboundCount} in=${signals.inboundCount})`,
    }
  }

  const floorStage = computeFloorStage(signals)
  if (floorStage === null) {
    return {
      assignedStage: null,
      skipReason: "no_signals",
      message: `thread ${threadExternalId} has ${threadRows.length} messages but no behavioral or reply signal`,
    }
  }

  // 3. Resolve the Account via majority vote on contacts → persons → account.
  const contactIds = Array.from(
    new Set(threadRows.map((m) => m.contactId).filter((v): v is string => Boolean(v))),
  )
  if (contactIds.length === 0) {
    return {
      assignedStage: null,
      skipReason: "no_account",
      message: `thread ${threadExternalId} has no addressable contacts (system-only messages)`,
    }
  }

  const contactRows = await db
    .select({ id: contacts.id, personId: contacts.personId, value: contacts.value })
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), inArray(contacts.id, contactIds)))

  const personIds = Array.from(new Set(contactRows.map((c) => c.personId)))
  const personRows = personIds.length
    ? await db
        .select({ id: persons.id, accountId: persons.accountId, fullName: persons.fullName })
        .from(persons)
        .where(and(eq(persons.workspaceId, workspaceId), inArray(persons.id, personIds)))
    : []

  const personById = new Map(personRows.map((p) => [p.id, p]))
  const accountVotes = new Map<string, number>()
  for (const c of contactRows) {
    const accId = personById.get(c.personId)?.accountId
    if (!accId) continue
    accountVotes.set(accId, (accountVotes.get(accId) ?? 0) + 1)
  }
  const accountId = pickTopVote(accountVotes)
  if (!accountId) {
    return {
      assignedStage: null,
      skipReason: "no_account",
      message: `thread ${threadExternalId} has contacts but none link to an Account (enrichment pending)`,
    }
  }

  // 4. Account history — collected for spec §7.11 #9 (gathered but not yet sent to prompt).
  const allAccountPersonRows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.workspaceId, workspaceId), eq(persons.accountId, accountId)))
  const allAccountPersonIds = allAccountPersonRows.map((p) => p.id)

  const allAccountContactRows = allAccountPersonIds.length
    ? await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.workspaceId, workspaceId),
            inArray(contacts.personId, allAccountPersonIds),
          ),
        )
    : []
  const allAccountContactIds = allAccountContactRows.map((c) => c.id)

  // 5. Resolve the buyer's domain.
  const [accountRow] = await db
    .select({ id: accounts.id, name: accounts.name, domain: accounts.domain })
    .from(accounts)
    .where(and(eq(accounts.workspaceId, workspaceId), eq(accounts.id, accountId)))
    .limit(1)

  // 5b. Workspace sales KB.
  const [wisdom, products] = await Promise.all([
    getAppliedWisdom(workspaceId),
    listWorkspaceProducts(workspaceId),
  ])
  const salesContext = buildSalesContext({ wisdom, products })

  // 6. Prepare LLM inputs.
  const thread = threadRows.slice(-MAX_MESSAGES_PER_THREAD).map((m) => ({
    direction: m.direction,
    subject: m.subject,
    body: truncate(m.body, MAX_BODY_CHARS_PER_MESSAGE),
    sentAt: m.sentAt.toISOString(),
    // The `contact_id` on a message is the buyer-side contact picked at
    // ingestion. For inbound that's the sender; for outbound it's the
    // recipient. Pass the email and let the prompt builder render it as
    // `from=` or `to=` based on direction (otherwise the LLM thinks the
    // buyer sent our outbound messages).
    buyerEmail: personEmailFor(m.contactId, contactRows),
  }))

  // 7. Run the classifier with bounded retry.
  let llmOut: LlmOutput
  let lastErr: unknown
  let attempt = 0
  while (attempt < LLM_MAX_ATTEMPTS) {
    attempt += 1
    try {
      const { object } = await callAIObject({
        provider: "anthropic",
        model: CLASSIFIER_MODEL,
        feature: CLASSIFIER_FEATURE,
        workspaceId,
        schema: llmOutputSchema,
        system: STAGE_CLASSIFIER_SYSTEM_PROMPT,
        prompt: buildUserPrompt({
          accountName: accountRow?.name ?? null,
          accountDomain: accountRow?.domain ?? null,
          thread,
          signals,
          floorStage,
          salesContext,
        }),
      })
      llmOut = object
      lastErr = undefined
      break
    } catch (err) {
      lastErr = err
      logger.warn(
        {
          workspaceId,
          threadExternalId,
          accountId,
          attempt,
          maxAttempts: LLM_MAX_ATTEMPTS,
          err: err instanceof Error ? err.message : String(err),
        },
        "[stage-classifier] LLM call failed",
      )
      if (attempt < LLM_MAX_ATTEMPTS) {
        await sleep(LLM_RETRY_BACKOFF_MS)
      }
    }
  }
  if (lastErr !== undefined) {
    logger.warn(
      {
        workspaceId,
        threadExternalId,
        accountId,
        threadMessageCount: threadRows.length,
        accountHistoryContactCount: allAccountContactIds.length,
        attempts: attempt,
        err: lastErr instanceof Error ? lastErr.message : String(lastErr),
      },
      "[stage-classifier] LLM retry exhausted",
    )
    return {
      assignedStage: null,
      skipReason: "classifier_error",
      message: lastErr instanceof Error ? lastErr.message : String(lastErr),
    }
  }
  // biome-ignore lint/style/noNonNullAssertion: llmOut is set when lastErr is undefined
  llmOut = llmOut!

  // 7b. Relevance gate. The LLM has read the thread + KB. Reject before
  // materializing for personal/transactional/recruiter noise.
  if (llmOut.is_about_business === false) {
    return {
      assignedStage: null,
      skipReason: "not_about_business",
      message: `thread ${threadExternalId} unrelated to workspace sales business: ${llmOut.business_relevance_reasoning}`,
    }
  }

  // 8. Resolve champion person.
  let championPersonId: string | null = null
  if (llmOut.champion_email) {
    const lowerEmail = llmOut.champion_email.toLowerCase().trim()
    const championContact = contactRows.find((c) => c.value.toLowerCase() === lowerEmail)
    championPersonId = championContact?.personId ?? null
  }
  if (!championPersonId) {
    const firstInbound = threadRows.find((m) => m.direction === "inbound")
    if (firstInbound?.contactId) {
      const contact = contactRows.find((c) => c.id === firstInbound.contactId)
      championPersonId = contact?.personId ?? null
    }
  }

  // Floor-clamp the LLM output (engine is authoritative on the lower bound).
  const finalStage = clampToFloor(llmOut.assigned_stage, floorStage)

  return {
    assignedStage: finalStage,
    confidenceScore: llmOut.confidence_score,
    detectedSignals: llmOut.detected_signals,
    rationaleText: llmOut.rationale_text,
    championPersonId,
    accountId,
    extractionJson: llmOut.extraction_json,
  }
}

// ============================================================================
// Prompt
// ============================================================================

const STAGE_CLASSIFIER_SYSTEM_PROMPT = `You are RINDA's Stage Classifier — you place a single email thread on a 5-stage export-sales pipeline (spec §3.1–3.5), AND you decide whether the thread is even about the workspace's sales business in the first place.

RELEVANCE GATE (run first, output as \`is_about_business\`):
Inbound messages to an export-sales rep's mailbox are noisy. Most threads in a freshly-imported mailbox are NOT buyer conversations — they are personal correspondence, payroll, calendar invites, password resets, software receipts, newsletters, recruiter outreach, investor cold-mail, legal/accounting/HR vendor coordination, internal team threads, etc. Creating a deal card for these wastes the rep's time and pollutes the pipeline.

The user prompt includes a SALES CONTEXT block summarising the workspace's products and accumulated sales wisdom. Use it to judge whether the thread is plausibly a real buyer conversation about THIS workspace's products / target market.

Decision rules:
- Off-topic threads (personal, vendor, internal, automated/transactional, recruiter, investor) → \`is_about_business: false\`.
- Threads on-topic for the workspace's products / target buyers → \`is_about_business: true\`.
- When the SALES CONTEXT is empty ("not yet configured"), default \`is_about_business: true\` — the rep hasn't told us what to filter on yet, so let everything through.
- When uncertain (vague intros, generic "let's talk", buyer-domain inbound with no commercial content yet) → default \`is_about_business: true\` — better to surface a borderline thread than silently drop a real buyer.
- Fill \`business_relevance_reasoning\` with one sentence stating WHY the thread is or isn't about the workspace's business, citing the strongest signal (e.g. "Sender domain stripe.com, content is a card receipt — not a buyer.").

If \`is_about_business: false\`, still output a valid \`assigned_stage\` (use the floor) and the other fields — downstream code drops the thread based on the boolean.

PIPELINE (evaluate in REVERSE order: Contract → Confirmed → Negotiating → In Conversation → Engaged):

§3.5 CONTRACT — contract execution in progress.
   Entry predicates (ANY):
     - contract template has been sent
     - e-signature flow is in progress (DocuSign, 모두싸인, "please sign", "signed copy attached")
     - company information collection is in progress (KYC, banking details, shipping address forms)
     - regulatory approval / licensing checklist is being processed (FDA, CE, CPNP, HALAL)
   Exit: all required signatures collected → deal graduates out of the Deal Pipeline (return "contract" while still in-flight).

§3.4 CONFIRMED — quotation accepted, contract not yet signed.
   Entry predicates (ALL):
     - quotation_sent = true (Proforma Invoice or Quotation document was sent in any outbound)
     - quotation_accepted = true (buyer expressed acceptance intent in any subsequent message — "approved", "let's proceed", "we'll order", "PO coming")
     - contract_signed = false
   Exit: buyer expresses intent to sign contract OR contract template has been sent → Contract.

§3.3 NEGOTIATING — commercial terms actively discussed.
   Entry predicates (commercial AND no quotation yet):
     - sample has been requested or sent, OR
     - at least one of {moq, payment_terms (T/T, L/C, 30%/70%), incoterms (FOB, CIF, EXW, DDP), unit_price} mentioned in the thread
     - AND quotation_sent = false
   Exit: Quotation/PI sent AND buyer expresses acceptance intent → Confirmed.

§3.2 IN_CONVERSATION — bidirectional dialogue, no commercial terms yet.
   Entry predicates:
     - reply_received = true (positive or neutral sentiment from buyer), OR inbound web form / inbound email received
     - AND intent ∉ {sample_request, price_inquiry, contract_terms} (no commercial signals yet)
   Exit: any message with intent ∈ {sample_request, price_inquiry, contract_terms, moq_inquiry} → Negotiating.

§3.1 ENGAGED — behavioral signals only, no reply yet.
   Entry predicates (ANY behavioral AND no reply):
     - email_opened_count ≥ 1, OR
     - attachment_opened = true (tracking-pixel / signed-URL download), OR
     - link_clicked = true (tracking redirect)
     - AND reply_received = false
   Exit: any inbound message from the buyer → In Conversation.

FLOOR CONSTRAINT (hard rule): a deterministic signal engine reads the mechanical predicates above (opens, clicks, replies, plus stub flags for the higher tiers) and returns \`floor_stage\` — the lowest stage already proven by wire evidence. Your output \`assigned_stage\` MUST be \`floor_stage\` OR a stage to the LEFT of it in the pipeline list (i.e. equal or higher commercial maturity). Demoting below the floor is forbidden — if you can't find evidence above the floor, return the floor verbatim. You are not asked to reject the thread; the engine already decided a Deal exists.

DECISION RULE: start at the floor. Read the bodies. If you find concrete prose evidence of a higher stage (buyer wrote "what's the MOQ?" → Negotiating; rep attached PI + buyer said "we'll proceed" → Confirmed; contract draft was sent → Contract), promote to that stage. When in doubt, return the floor.

OUTPUT: respect the schema. \`detected_signals\` should be 3–8 short tokens drawn from the spec vocabulary where applicable ("sample_sent", "moq_5000", "fob_busan", "buyer_accepted_quote", "pi_sent", "contract_template_sent", "e_sig_in_progress"). \`rationale_text\` ≤ 200 chars, written for the rep ("Buyer requested 5,000-unit sample to Busan; quote not yet sent"). \`champion_email\` is the most active BUYER-SIDE email (not the rep). \`extraction_json\` is a flat object with extracted entities (moq as number, payment_terms as string, incoterms as string, currency as ISO 4217, unit_price as number, deal_size as number, expected_close_date as ISO date, sample_requested as boolean, sample_sent as boolean, quotation_sent as boolean, quotation_accepted as boolean, contract_signed as boolean, contract_template_sent as boolean). Use \`null\` for anything not present — do not invent.`

function buildUserPrompt(args: {
  accountName: string | null
  accountDomain: string | null
  thread: Array<{
    direction: "inbound" | "outbound"
    subject: string | null
    body: string
    sentAt: string
    /** Buyer-side email on this message (sender for inbound, recipient for outbound). */
    buyerEmail: string | null
  }>
  signals: ThreadSignals
  floorStage: DealStage
  salesContext: string
}): string {
  const header = `ACCOUNT: ${args.accountName ?? "(unknown)"} ${args.accountDomain ? `(${args.accountDomain})` : ""}\n`
  const salesContextBlock = `SALES CONTEXT (workspace's products + wisdom):\n${args.salesContext}\n`
  const s = args.signals
  const signalsText =
    `MECHANICAL SIGNALS (computed by signal engine):\n` +
    `  inbound_count                          = ${s.inboundCount}\n` +
    `  outbound_count                         = ${s.outboundCount}\n` +
    `  email_opened_count                     = ${s.emailOpenedCount}\n` +
    `  link_clicked                           = ${s.linkClicked}\n` +
    `  attachment_opened                      = ${s.attachmentOpened}\n` +
    `  reply_received                         = ${s.replyReceived}\n` +
    `  sample_requested_or_sent               = ${s.sampleRequestedOrSent}\n` +
    `  moq_mentioned                          = ${s.moqMentioned}\n` +
    `  payment_terms_mentioned                = ${s.paymentTermsMentioned}\n` +
    `  incoterms_mentioned                    = ${s.incotermsMentioned}\n` +
    `  unit_price_mentioned                   = ${s.unitPriceMentioned}\n` +
    `  quotation_sent                         = ${s.quotationSent}\n` +
    `  quotation_accepted                     = ${s.quotationAccepted}\n` +
    `  contract_signed                        = ${s.contractSigned}\n` +
    `  contract_template_sent                 = ${s.contractTemplateSent}\n` +
    `  e_signature_in_progress                = ${s.eSignatureInProgress}\n` +
    `  company_info_collection_in_progress    = ${s.companyInfoCollectionInProgress}\n` +
    `  regulatory_approval_in_progress        = ${s.regulatoryApprovalInProgress}\n` +
    `FLOOR_STAGE: ${args.floorStage}  ← your output must be this stage or higher.\n` +
    `Note: many of the higher-tier flags above are stubbed false until message-level\n` +
    `extraction lands. When the body clearly shows a commercial/quotation/contract\n` +
    `signal even though the corresponding flag reads false, you may still promote.\n`
  const threadText = args.thread
    .map((m, i) => {
      // For outbound the rep is the sender; the contact on the message row is
      // the buyer-side recipient. Render the buyer email as `from=` on inbound
      // and `to=` on outbound so the LLM doesn't think the buyer wrote our
      // own outbound messages.
      const buyerLabel = m.direction === "inbound" ? "from" : "to"
      return (
        `--- Message ${i + 1} (${m.direction}, ${m.sentAt}, ${buyerLabel}=${m.buyerEmail ?? "?"}) ---\n` +
        (m.subject ? `Subject: ${m.subject}\n` : "") +
        m.body
      )
    })
    .join("\n\n")
  return `${header}\n${salesContextBlock}\n${signalsText}\nTHREAD (${args.thread.length} messages, chronological):\n\n${threadText}`
}

function buildSalesContext(args: {
  wisdom: { paragraph: string } | null
  products: Array<{
    name: string | null
    description: string | null
    category: string | null
    targetAudience: string | null
  }>
}): string {
  const sections: string[] = []

  if (args.products.length > 0) {
    const productLines = args.products.slice(0, MAX_PRODUCTS_IN_PROMPT).map((p) => {
      const name = p.name?.trim() || "(unnamed)"
      const description = p.description
        ? truncate(p.description, MAX_PRODUCT_DESCRIPTION_CHARS)
        : ""
      const meta: string[] = []
      if (p.category) meta.push(`category=${p.category}`)
      if (p.targetAudience) meta.push(`target=${p.targetAudience}`)
      const metaText = meta.length > 0 ? ` [${meta.join(", ")}]` : ""
      return `- ${name}${metaText}${description ? `: ${description}` : ""}`
    })
    const overflow = args.products.length - MAX_PRODUCTS_IN_PROMPT
    if (overflow > 0) productLines.push(`- (+${overflow} more products omitted)`)
    sections.push(`Products:\n${productLines.join("\n")}`)
  }

  const paragraph = args.wisdom?.paragraph?.trim()
  if (paragraph && paragraph.length > 0) {
    sections.push(
      `Sales wisdom (ICP, voice, lessons learned):\n${truncate(paragraph, MAX_WISDOM_CHARS)}`,
    )
  }

  if (sections.length === 0) return "(not yet configured — default is_about_business to true)"
  return sections.join("\n\n")
}

// ============================================================================
// Helpers
// ============================================================================

function pickTopVote(votes: Map<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [k, v] of votes) {
    if (v > bestCount) {
      best = k
      bestCount = v
    }
  }
  return best
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function personEmailFor(
  contactId: string | null,
  contactRows: Array<{ id: string; value: string }>,
): string | null {
  if (!contactId) return null
  return contactRows.find((c) => c.id === contactId)?.value ?? null
}

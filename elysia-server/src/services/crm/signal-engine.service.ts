/**
 * Thread Signal Engine — deterministic stage floor from message-level signals.
 *
 * Lifted verbatim from send-grid-test/elysia-server/src/services/crm/signal-engine.service.ts.
 *
 * The engine is authoritative on the LOWER bound; the LLM may PROMOTE above the
 * floor (catching prose-only signals the mechanical columns miss), never DEMOTE.
 *
 *   3.1 Engaged       — outbound + (open || click || attachment_opened) AND !replyReceived
 *   3.2 In Conversation — replyReceived AND no commercial signal yet
 *   3.3 Negotiating   — (sample req/sent || moq/payment_terms/incoterms/unit_price mentioned) AND !quotation_sent
 *   3.4 Confirmed     — quotation_sent AND quotation_accepted AND !contract_signed
 *   3.5 Contract      — contract_template_sent || e_signature_in_progress
 *                       || company_info_collection_in_progress || regulatory_approval_in_progress
 *
 * Today only §3.1/§3.2 inputs land on real columns. §3.3+ are stubs until
 * per-message extraction ships — the full predicate tree is encoded so the
 * floor auto-rises when those signals flip true, no algorithm change needed.
 */

import type { DealStage } from "../../db/schema/crm-deals"

export interface ThreadSignals {
  inboundCount: number
  outboundCount: number
  emailOpenedCount: number
  linkClicked: boolean
  attachmentOpened: boolean
  replyReceived: boolean

  /**
   * Pipeline-eligibility gate. True iff the thread's first message direction
   * is OUTBOUND. False on pure-inbound threads (login alerts, "verify your
   * email", newsletters). Authoritative — if false the classifier
   * short-circuits and no Deal is materialized.
   */
  firstMessageIsOutbound: boolean

  // §3.3 — stubs until per-message LLM extraction ships.
  sampleRequestedOrSent: boolean
  moqMentioned: boolean
  paymentTermsMentioned: boolean
  incotermsMentioned: boolean
  unitPriceMentioned: boolean

  // §3.4 — stubs until send-flow + per-message intent tracking.
  quotationSent: boolean
  quotationAccepted: boolean
  contractSigned: boolean

  // §3.5 — stubs until contract-flow integration.
  contractTemplateSent: boolean
  eSignatureInProgress: boolean
  companyInfoCollectionInProgress: boolean
  regulatoryApprovalInProgress: boolean
}

export interface ThreadMessageForSignals {
  direction: "inbound" | "outbound"
  sentAt: Date
  openedAt: Date | null
  clickedAt: Date | null
  repliedAt: Date | null
}

export function computeThreadSignals(messages: ThreadMessageForSignals[]): ThreadSignals {
  // Sort defensively. Tie-break: outbound before inbound at the same instant —
  // a same-second auto-ack can't make a thread we initiated look inbound-initiated.
  const ordered = [...messages].sort((a, b) => {
    const dt = a.sentAt.getTime() - b.sentAt.getTime()
    if (dt !== 0) return dt
    if (a.direction === b.direction) return 0
    return a.direction === "outbound" ? -1 : 1
  })

  let inboundCount = 0
  let outboundCount = 0
  let emailOpenedCount = 0
  let linkClicked = false
  let replyReceived = false
  for (const m of ordered) {
    if (m.direction === "inbound") {
      inboundCount += 1
      replyReceived = true
    } else {
      outboundCount += 1
      if (m.openedAt) emailOpenedCount += 1
      if (m.clickedAt) linkClicked = true
      if (m.repliedAt) replyReceived = true
    }
  }

  const firstMessageIsOutbound = ordered[0]?.direction === "outbound"

  return {
    inboundCount,
    outboundCount,
    emailOpenedCount,
    linkClicked,
    replyReceived,
    firstMessageIsOutbound,
    attachmentOpened: false,
    sampleRequestedOrSent: false,
    moqMentioned: false,
    paymentTermsMentioned: false,
    incotermsMentioned: false,
    unitPriceMentioned: false,
    quotationSent: false,
    quotationAccepted: false,
    contractSigned: false,
    contractTemplateSent: false,
    eSignatureInProgress: false,
    companyInfoCollectionInProgress: false,
    regulatoryApprovalInProgress: false,
  }
}

export function computeFloorStage(signals: ThreadSignals): DealStage | null {
  if (
    signals.contractTemplateSent ||
    signals.eSignatureInProgress ||
    signals.companyInfoCollectionInProgress ||
    signals.regulatoryApprovalInProgress
  ) {
    return "contract"
  }

  if (signals.quotationSent && signals.quotationAccepted && !signals.contractSigned) {
    return "confirmed"
  }

  const hasCommercialMention =
    signals.sampleRequestedOrSent ||
    signals.moqMentioned ||
    signals.paymentTermsMentioned ||
    signals.incotermsMentioned ||
    signals.unitPriceMentioned
  if (hasCommercialMention && !signals.quotationSent) {
    return "negotiating"
  }

  if (signals.replyReceived) {
    return "in_conversation"
  }

  const hasBehavioralSignal =
    signals.emailOpenedCount > 0 || signals.linkClicked || signals.attachmentOpened
  if (signals.outboundCount > 0 && hasBehavioralSignal && !signals.replyReceived) {
    return "engaged"
  }

  return null
}

const STAGE_ORDER: DealStage[] = [
  "engaged",
  "in_conversation",
  "negotiating",
  "confirmed",
  "contract",
]

/** Clamp a candidate stage to be at least `floor`. */
export function clampToFloor(candidate: DealStage, floor: DealStage): DealStage {
  const cIdx = STAGE_ORDER.indexOf(candidate)
  const fIdx = STAGE_ORDER.indexOf(floor)
  return cIdx >= fIdx ? candidate : floor
}

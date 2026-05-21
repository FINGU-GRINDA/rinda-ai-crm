import { GmailEmailProvider } from "./gmail"
import type { EmailProvider } from "./types"

export type { EmailProvider, ListPageArgs, ListPageResult, MailboxEmail } from "./types"

const providers = new Map<string, EmailProvider>()

/**
 * Resolve the configured EmailProvider for a connection's `provider` value.
 *
 * Slice 1 only supports `gmail`. The Unipile stub is intentionally NOT
 * registered here — wiring it up would let a stored connection with
 * `provider = "unipile"` (manually inserted, e.g. via psql) leak through the
 * route's Zod gate and surface as a delayed runtime failure in the worker.
 * Fail fast at provider resolution instead.
 */
export function getEmailProvider(provider: string): EmailProvider {
  let p = providers.get(provider)
  if (!p) {
    if (provider === "gmail") {
      p = new GmailEmailProvider()
    } else {
      throw new Error(`Unsupported email provider: ${provider}. Slice 1 only supports "gmail".`)
    }
    providers.set(provider, p)
  }
  return p
}

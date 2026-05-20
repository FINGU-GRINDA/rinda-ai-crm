import { GmailEmailProvider } from "./gmail"
import type { EmailProvider } from "./types"
import { UnipileEmailProvider } from "./unipile"

export type { EmailProvider, ListPageArgs, ListPageResult, MailboxEmail } from "./types"

const providers = new Map<string, EmailProvider>()

export function getEmailProvider(provider: string): EmailProvider {
  let p = providers.get(provider)
  if (!p) {
    if (provider === "gmail") {
      p = new GmailEmailProvider()
    } else if (provider === "unipile") {
      p = new UnipileEmailProvider()
    } else {
      throw new Error(`Unknown email provider: ${provider}`)
    }
    providers.set(provider, p)
  }
  return p
}

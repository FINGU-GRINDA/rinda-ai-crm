/**
 * Unipile EmailProvider — slice 2 placeholder. Compiles but throws on use.
 */

import type { EmailProvider, ListPageArgs, ListPageResult } from "./types"

export class UnipileEmailProvider implements EmailProvider {
  async listPage(_args: ListPageArgs): Promise<ListPageResult> {
    throw new Error("UnipileEmailProvider is not implemented in slice 1")
  }
}

/**
 * Workspace sales wisdom — slice 1 stub.
 *
 * Shape matches what the lifted stage-classifier reads in `buildSalesContext`.
 * Slice 1 returns null — classifier comment notes "missing KB is fine — the
 * prompt defaults `is_about_business` to true in that case."
 */

export interface AppliedWisdom {
  paragraph: string
}

export async function getAppliedWisdom(_workspaceId: string): Promise<AppliedWisdom | null> {
  return null
}

/**
 * Workspace product catalog — slice 1 stub.
 *
 * Shape matches what the lifted stage-classifier reads in `buildSalesContext`.
 * Slice 1 returns an empty list — classifier comment notes "missing KB is
 * fine — the prompt defaults `is_about_business` to true in that case."
 */

export interface WorkspaceProduct {
  name: string | null
  description: string | null
  category: string | null
  targetAudience: string | null
}

export async function listWorkspaceProducts(_workspaceId: string): Promise<WorkspaceProduct[]> {
  return []
}

import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { db } from "../db"
import {
  DEFAULT_PIPELINE_TEMPLATES,
  type PipelineTemplateKey,
  pipelineStages,
  pipelines,
} from "../db/schema/pipelines"
import { sequences } from "../db/schema/sequences"
import {
  type Organization,
  organizations,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceMemberRole,
  workspaceMembers,
  workspaces,
} from "../db/schema/workspaces"

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceMemberRole
  isDefault: number
  organizationName: string
}

export interface CreateWorkspaceInput {
  organizationName: string
  organizationSlug?: string
  workspaceName: string
  workspaceSlug?: string
  baseCurrency?: string
  locale?: string
  timezone?: string
  pipelineTemplate?: PipelineTemplateKey
  ownerUserId: string
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60)
}

export const workspaceRepository = {
  listForUser: async (userId: string): Promise<WorkspaceWithRole[]> => {
    const rows = await db
      .select({
        workspace: workspaces,
        role: workspaceMembers.role,
        isDefault: workspaceMembers.isDefault,
        organizationName: organizations.name,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .innerJoin(organizations, eq(organizations.id, workspaces.organizationId))
      .where(and(eq(workspaceMembers.userId, userId), isNull(workspaces.archivedAt)))
      .orderBy(asc(workspaces.createdAt))

    return rows.map((row) => ({
      ...row.workspace,
      role: row.role,
      isDefault: row.isDefault,
      organizationName: row.organizationName,
    }))
  },

  findById: async (workspaceId: string): Promise<Workspace | null> => {
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
    return row ?? null
  },

  /**
   * Create an organization + a single workspace + owner membership in one
   * transaction. Optionally seed a starter pipeline template.
   */
  bootstrap: async (
    input: CreateWorkspaceInput,
  ): Promise<{
    organization: Organization
    workspace: Workspace
    membership: WorkspaceMember
  }> => {
    const orgName = input.organizationName.trim()
    if (!orgName) throw new Error("organizationName required")

    const wsName = input.workspaceName.trim() || orgName
    const baseSlug = input.organizationSlug?.trim() || slugify(orgName)
    const wsSlug = input.workspaceSlug?.trim() || slugify(wsName) || "default"

    return await db.transaction(async (tx) => {
      // De-dupe slug if needed
      const orgSlug = await ensureUniqueOrgSlug(tx, baseSlug)

      const [organization] = await tx
        .insert(organizations)
        .values({
          name: orgName,
          slug: orgSlug,
          defaultCurrency: input.baseCurrency ?? "USD",
          defaultLocale: input.locale ?? "en-US",
          defaultTimezone: input.timezone ?? "UTC",
        })
        .returning()

      if (!organization) throw new Error("Failed to create organization")

      const [workspace] = await tx
        .insert(workspaces)
        .values({
          organizationId: organization.id,
          name: wsName,
          slug: wsSlug,
          baseCurrency: input.baseCurrency ?? organization.defaultCurrency,
          locale: input.locale ?? organization.defaultLocale,
          timezone: input.timezone ?? organization.defaultTimezone,
        })
        .returning()

      if (!workspace) throw new Error("Failed to create workspace")

      const [membership] = await tx
        .insert(workspaceMembers)
        .values({
          workspaceId: workspace.id,
          userId: input.ownerUserId,
          role: "owner",
          isDefault: 1,
          joinedAt: new Date(),
        })
        .returning()

      if (!membership) throw new Error("Failed to create membership")

      // Seed sequence for human-readable deal IDs
      await tx.insert(sequences).values({
        workspaceId: workspace.id,
        key: "deal",
        nextValue: 1n,
      })

      // Seed pipeline template (defaults to B2B SaaS)
      const templateKey: PipelineTemplateKey = input.pipelineTemplate ?? "b2b-saas"
      const template = DEFAULT_PIPELINE_TEMPLATES[templateKey]

      const [pipeline] = await tx
        .insert(pipelines)
        .values({
          workspaceId: workspace.id,
          name: template.name,
          isDefault: 1,
          displayOrder: 0,
        })
        .returning()

      if (!pipeline) throw new Error("Failed to create starter pipeline")

      await tx.insert(pipelineStages).values(
        template.stages.map((stage, idx) => ({
          workspaceId: workspace.id,
          pipelineId: pipeline.id,
          name: stage.name,
          stageType: stage.stageType,
          displayOrder: idx,
          defaultProbability: stage.defaultProbability,
          color: stage.color,
        })),
      )

      return { organization, workspace, membership }
    })
  },

  /**
   * Allocate the next human-readable deal id (e.g. DEAL-2026-00123) atomically.
   * Uses SELECT ... FOR UPDATE to avoid races.
   */
  nextDealHumanId: async (workspaceId: string): Promise<string> => {
    return await db.transaction(async (tx) => {
      const rows = await tx.execute(
        sql`SELECT next_value FROM sequences WHERE workspace_id = ${workspaceId} AND key = ${"deal"} AND scope IS NULL FOR UPDATE`,
      )

      const row = (rows.rows ?? rows)[0] as { next_value: bigint | string } | undefined
      const current = row ? BigInt(row.next_value) : 1n

      if (!row) {
        await tx.insert(sequences).values({
          workspaceId,
          key: "deal",
          nextValue: current + 1n,
        })
      } else {
        await tx.execute(
          sql`UPDATE sequences SET next_value = ${(current + 1n).toString()}::bigint, updated_at = NOW() WHERE workspace_id = ${workspaceId} AND key = ${"deal"} AND scope IS NULL`,
        )
      }

      const year = new Date().getFullYear()
      return `DEAL-${year}-${current.toString().padStart(5, "0")}`
    })
  },
}

async function ensureUniqueOrgSlug(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  baseSlug: string,
): Promise<string> {
  const safeBase = baseSlug || "org"
  let candidate = safeBase
  let suffix = 1
  for (;;) {
    const [existing] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1)
    if (!existing) return candidate
    suffix += 1
    candidate = `${safeBase}-${suffix}`
    if (suffix > 50) throw new Error("Could not find unique organization slug")
  }
}

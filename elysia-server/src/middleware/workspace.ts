import { and, asc, eq, isNull } from "drizzle-orm"
import { Elysia } from "elysia"
import { db } from "../db"
import { type WorkspaceMemberRole, workspaceMembers, workspaces } from "../db/schema/workspaces"
import { authMiddleware } from "./auth"

export interface WorkspaceContext {
  workspaceId: string
  organizationId: string
  role: WorkspaceMemberRole
  baseCurrency: string
  locale: string
  timezone: string
}

/**
 * Resolve the active workspace for the authenticated user.
 *
 * Selection order:
 *   1. Explicit `X-Workspace-Id` header (if user is a member of that workspace).
 *   2. The user's default workspace membership (is_default = 1).
 *   3. The user's first non-archived workspace, ordered by membership creation.
 *
 * Throws 403 if the user has no workspaces yet — callers should bootstrap one
 * via the workspace.routes.ts `POST /api/workspaces` endpoint first.
 */
export const workspaceMiddleware = new Elysia({ name: "workspace" })
  .use(authMiddleware)
  .derive({ as: "scoped" }, async ({ auth, set, request }) => {
    // auth is guaranteed populated by authMiddleware (which throws on failure),
    // but TS cannot prove the non-null path through derive composition.
    if (!auth) {
      set.status = 401
      throw new Error("Authentication required")
    }

    const requestedWorkspaceId = request.headers.get("x-workspace-id") ?? undefined

    if (requestedWorkspaceId) {
      const [membership] = await db
        .select({
          workspaceId: workspaceMembers.workspaceId,
          role: workspaceMembers.role,
          organizationId: workspaces.organizationId,
          baseCurrency: workspaces.baseCurrency,
          locale: workspaces.locale,
          timezone: workspaces.timezone,
          archivedAt: workspaces.archivedAt,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(
          and(
            eq(workspaceMembers.userId, auth.userId),
            eq(workspaceMembers.workspaceId, requestedWorkspaceId),
          ),
        )
        .limit(1)

      if (!membership || membership.archivedAt) {
        set.status = 403
        throw new Error("Workspace not accessible")
      }

      return {
        auth,
        workspace: {
          workspaceId: membership.workspaceId,
          organizationId: membership.organizationId,
          role: membership.role,
          baseCurrency: membership.baseCurrency,
          locale: membership.locale,
          timezone: membership.timezone,
        } as WorkspaceContext,
      }
    }

    const [defaultMembership] = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        organizationId: workspaces.organizationId,
        baseCurrency: workspaces.baseCurrency,
        locale: workspaces.locale,
        timezone: workspaces.timezone,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, auth.userId),
          eq(workspaceMembers.isDefault, 1),
          isNull(workspaces.archivedAt),
        ),
      )
      .limit(1)

    if (defaultMembership) {
      return {
        auth,
        workspace: {
          workspaceId: defaultMembership.workspaceId,
          organizationId: defaultMembership.organizationId,
          role: defaultMembership.role,
          baseCurrency: defaultMembership.baseCurrency,
          locale: defaultMembership.locale,
          timezone: defaultMembership.timezone,
        } as WorkspaceContext,
      }
    }

    const [anyMembership] = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        organizationId: workspaces.organizationId,
        baseCurrency: workspaces.baseCurrency,
        locale: workspaces.locale,
        timezone: workspaces.timezone,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(and(eq(workspaceMembers.userId, auth.userId), isNull(workspaces.archivedAt)))
      .orderBy(asc(workspaceMembers.createdAt))
      .limit(1)

    if (!anyMembership) {
      set.status = 403
      throw new Error("No workspace available — create or join one first")
    }

    return {
      auth,
      workspace: {
        workspaceId: anyMembership.workspaceId,
        organizationId: anyMembership.organizationId,
        role: anyMembership.role,
        baseCurrency: anyMembership.baseCurrency,
        locale: anyMembership.locale,
        timezone: anyMembership.timezone,
      } as WorkspaceContext,
    }
  })

/**
 * Coarse role check helper used inside route handlers.
 * Owner/admin can do everything; manager can mutate; member can mutate scoped
 * resources; viewer is read-only.
 */
export function requireRole(
  ctx: WorkspaceContext,
  allowed: ReadonlyArray<WorkspaceMemberRole>,
): void {
  if (!allowed.includes(ctx.role)) {
    const err = new Error(`Role '${ctx.role}' is not authorized for this action`)
    ;(err as Error & { status?: number }).status = 403
    throw err
  }
}

// Re-exported as a string set for use outside of TS context
export const ROLE_WRITE: ReadonlyArray<WorkspaceMemberRole> = [
  "owner",
  "admin",
  "manager",
  "member",
]
export const ROLE_ADMIN: ReadonlyArray<WorkspaceMemberRole> = ["owner", "admin"]
export const ROLE_OWNER: ReadonlyArray<WorkspaceMemberRole> = ["owner"]

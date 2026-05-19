import { Elysia, t } from "elysia"
import { authMiddleware } from "../middleware/auth"
import { workspaceMiddleware } from "../middleware/workspace"
import { workspaceRepository } from "../repositories/workspace.repository"
import { ErrorCode, error, success, successList } from "../utils/response"

const PIPELINE_TEMPLATE_VALUES = ["b2b-saas", "agency", "ecommerce"] as const

export const workspaceRoutes = new Elysia({ prefix: "/api/workspaces" })
  // List workspaces the authenticated user belongs to (no workspace context required).
  .use(authMiddleware)
  .get("/", async ({ auth }) => {
    const list = await workspaceRepository.listForUser(auth.userId)
    return successList(list, list.length)
  })

  // Bootstrap a new organization + workspace + seed pipeline for the user.
  .post(
    "/",
    async ({ auth, body, set }) => {
      const result = await workspaceRepository.bootstrap({
        ownerUserId: auth.userId,
        organizationName: body.organizationName,
        organizationSlug: body.organizationSlug,
        workspaceName: body.workspaceName ?? body.organizationName,
        workspaceSlug: body.workspaceSlug,
        baseCurrency: body.baseCurrency,
        locale: body.locale,
        timezone: body.timezone,
        pipelineTemplate: body.pipelineTemplate,
      })
      set.status = 201
      return success(result)
    },
    {
      body: t.Object({
        organizationName: t.String({ minLength: 1, maxLength: 120 }),
        organizationSlug: t.Optional(t.String({ maxLength: 60 })),
        workspaceName: t.Optional(t.String({ maxLength: 120 })),
        workspaceSlug: t.Optional(t.String({ maxLength: 60 })),
        baseCurrency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        locale: t.Optional(t.String({ maxLength: 16 })),
        timezone: t.Optional(t.String({ maxLength: 64 })),
        pipelineTemplate: t.Optional(
          t.Union(PIPELINE_TEMPLATE_VALUES.map((value) => t.Literal(value))),
        ),
      }),
    },
  )

  // Read details of the currently-active workspace (uses workspace middleware).
  .use(workspaceMiddleware)
  .get("/current", async ({ workspace, set }) => {
    const ws = await workspaceRepository.findById(workspace.workspaceId)
    if (!ws) {
      set.status = 404
      return error("Workspace not found", ErrorCode.WORKSPACE_NOT_FOUND)
    }
    return success({ ...ws, role: workspace.role })
  })

import { Elysia, t } from "elysia"
import { icpRepository } from "../repositories"
import { ErrorCode, error, success, successList } from "../utils/response"

export const icpRoutes = new Elysia({ prefix: "/api/icp" })
  // Get all ICP profiles
  .get("/", async () => {
    const profiles = await icpRepository.findAll()
    const parsed = profiles.map((p) => icpRepository.parseProfile(p))
    return successList(parsed)
  })

  // Get ICP profile by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const profile = await icpRepository.findById(params.id)
      if (!profile) {
        set.status = 404
        return error("ICP profile not found", ErrorCode.ICP_NOT_FOUND)
      }
      return success(icpRepository.parseProfile(profile))
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create ICP profile
  .post(
    "/",
    async ({ body, set }) => {
      const stringified = icpRepository.stringifyData({
        industries: body.industries,
        keywords: body.keywords,
        targetRegions: body.targetRegions,
      })

      const profile = await icpRepository.create({
        name: body.name,
        companySize: body.companySize,
        ...stringified,
      })

      set.status = 201
      return success(icpRepository.parseProfile(profile))
    },
    {
      body: t.Object({
        name: t.String(),
        industries: t.Optional(t.Array(t.String())),
        keywords: t.Optional(t.Array(t.String())),
        companySize: t.Optional(t.String()),
        targetRegions: t.Optional(t.Array(t.String())),
      }),
    },
  )

  // Update ICP profile
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const stringified = icpRepository.stringifyData({
        industries: body.industries,
        keywords: body.keywords,
        targetRegions: body.targetRegions,
      })

      const profile = await icpRepository.update(params.id, {
        name: body.name,
        companySize: body.companySize,
        ...stringified,
      })

      if (!profile) {
        set.status = 404
        return error("ICP profile not found", ErrorCode.ICP_NOT_FOUND)
      }

      return success(icpRepository.parseProfile(profile))
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        industries: t.Optional(t.Array(t.String())),
        keywords: t.Optional(t.Array(t.String())),
        companySize: t.Optional(t.String()),
        targetRegions: t.Optional(t.Array(t.String())),
      }),
    },
  )

  // Delete ICP profile
  .delete(
    "/:id",
    async ({ params }) => {
      await icpRepository.delete(params.id)
      return success({ deleted: true })
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

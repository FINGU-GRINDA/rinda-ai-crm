import { Elysia, t } from "elysia"
import { contactRepository } from "../repositories"
import { ErrorCode, error, success } from "../utils/response"

export const contactRoutes = new Elysia({ prefix: "/api/contacts" })
  // Get contact by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const contact = await contactRepository.findById(params.id)
      if (!contact) {
        set.status = 404
        return error("Contact not found", ErrorCode.CONTACT_NOT_FOUND)
      }
      return success(contact)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Update contact
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const contact = await contactRepository.update(params.id, body)
      if (!contact) {
        set.status = 404
        return error("Contact not found", ErrorCode.CONTACT_NOT_FOUND)
      }
      return success(contact)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        title: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
      }),
    },
  )

  // Delete contact
  .delete(
    "/:id",
    async ({ params }) => {
      await contactRepository.delete(params.id)
      return success({ deleted: true })
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Set contact as primary
  .post(
    "/:id/primary",
    async ({ params, body, set }) => {
      const contact = await contactRepository.setPrimary(params.id, body.customerId)
      if (!contact) {
        set.status = 404
        return error("Contact not found", ErrorCode.CONTACT_NOT_FOUND)
      }
      return success(contact)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ customerId: t.String() }),
    },
  )

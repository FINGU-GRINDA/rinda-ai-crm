import { and, desc, eq } from "drizzle-orm"
import { db } from "../db"
import { type CustomerContact, customerContacts, type NewCustomerContact } from "../db/schema"
import { generateId } from "../utils/id-generator"

export const contactRepository = {
  findByCustomerId: async (customerId: string): Promise<CustomerContact[]> => {
    return db
      .select()
      .from(customerContacts)
      .where(eq(customerContacts.customerId, customerId))
      .orderBy(desc(customerContacts.isPrimary), desc(customerContacts.createdAt))
  },

  findById: async (id: string): Promise<CustomerContact | null> => {
    const result = await db.select().from(customerContacts).where(eq(customerContacts.id, id))
    return result[0] || null
  },

  findPrimaryByCustomerId: async (customerId: string): Promise<CustomerContact | null> => {
    const result = await db
      .select()
      .from(customerContacts)
      .where(and(eq(customerContacts.customerId, customerId), eq(customerContacts.isPrimary, 1)))
    return result[0] || null
  },

  create: async (data: Partial<NewCustomerContact>): Promise<CustomerContact> => {
    const id = generateId()
    const now = Date.now()
    const [contact] = await db
      .insert(customerContacts)
      .values({
        id,
        customerId: data.customerId || "",
        name: data.name || "",
        title: data.title,
        email: data.email,
        phone: data.phone,
        isPrimary: data.isPrimary || 0,
        source: data.source || "manual",
        businessCardImageUrl: data.businessCardImageUrl,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!contact) throw new Error("Failed to create contact")
    return contact
  },

  update: async (
    id: string,
    data: Partial<NewCustomerContact>,
  ): Promise<CustomerContact | null> => {
    const [contact] = await db
      .update(customerContacts)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(customerContacts.id, id))
      .returning()
    return contact || null
  },

  delete: async (id: string): Promise<boolean> => {
    await db.delete(customerContacts).where(eq(customerContacts.id, id))
    return true
  },

  setPrimary: async (id: string, customerId: string): Promise<CustomerContact | null> => {
    // First, unset all primary flags for this customer
    await db
      .update(customerContacts)
      .set({ isPrimary: 0, updatedAt: Date.now() })
      .where(eq(customerContacts.customerId, customerId))

    // Then set the specified contact as primary
    const [contact] = await db
      .update(customerContacts)
      .set({ isPrimary: 1, updatedAt: Date.now() })
      .where(eq(customerContacts.id, id))
      .returning()

    return contact || null
  },
}

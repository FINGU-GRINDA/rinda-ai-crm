import { bigint, index, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core"
import { customers } from "./customers"

export const contactSourceEnum = pgEnum("contact_source", ["manual", "business_card", "import"])

export const customerContacts = pgTable(
  "customer_contacts",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: integer("is_primary").default(0),
    source: contactSourceEnum("source").default("manual"),
    businessCardImageUrl: text("business_card_image_url"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_contacts_customer").on(table.customerId),
    index("idx_contacts_email").on(table.email),
    index("idx_contacts_primary").on(table.isPrimary),
  ],
)

export type CustomerContact = typeof customerContacts.$inferSelect
export type NewCustomerContact = typeof customerContacts.$inferInsert

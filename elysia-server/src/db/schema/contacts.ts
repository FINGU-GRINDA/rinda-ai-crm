import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { workspaces } from "./workspaces"

export const contactSourceEnum = pgEnum("contact_source", ["manual", "business_card", "import"])

export const customerContacts = pgTable(
  "customer_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: integer("is_primary").default(0),
    source: contactSourceEnum("source").default("manual"),
    businessCardImageUrl: text("business_card_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contacts_customer").on(table.customerId),
    index("idx_contacts_email").on(table.email),
    index("idx_contacts_primary").on(table.isPrimary),
    index("idx_contacts_workspace").on(table.workspaceId),
  ],
)

export type CustomerContact = typeof customerContacts.$inferSelect
export type NewCustomerContact = typeof customerContacts.$inferInsert

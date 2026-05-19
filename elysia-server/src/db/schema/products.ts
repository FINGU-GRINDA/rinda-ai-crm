import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { deals } from "./deals"
import { workspaces } from "./workspaces"

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    description: text("description"),
    defaultUnitPriceMinor: bigint("default_unit_price_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    currency: text("currency").notNull().default("USD"),
    isActive: integer("is_active").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_products_workspace").on(table.workspaceId, table.isActive),
    uniqueIndex("idx_products_workspace_sku")
      .on(table.workspaceId, table.sku)
      .where(sql`${table.sku} IS NOT NULL`),
    check("products_currency_iso", sql`char_length(${table.currency}) = 3`),
  ],
)

export const dealLineItems = pgTable(
  "deal_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    // Free-text name snapshot at line-item creation (survives product deletion)
    name: text("name").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull().default("1.0000"),
    unitPriceMinor: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0.00"),
    currency: text("currency").notNull().default("USD"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_line_items_deal").on(table.dealId, table.sortOrder),
    index("idx_line_items_workspace").on(table.workspaceId),
    check(
      "line_items_discount_range",
      sql`${table.discountPct} >= 0 AND ${table.discountPct} <= 100`,
    ),
    check("line_items_currency_iso", sql`char_length(${table.currency}) = 3`),
  ],
)

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type DealLineItem = typeof dealLineItems.$inferSelect
export type NewDealLineItem = typeof dealLineItems.$inferInsert

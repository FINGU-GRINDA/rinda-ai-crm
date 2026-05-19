// CRM barrel — separate from `schema.ts` because both repos define a `deals`
// table and we can't co-export them through one file. drizzle-kit reads both
// barrels via the `schema` array in `drizzle.config.ts`.

export * from "./schema/crm-backfill-progress"
export * from "./schema/crm-core"
export * from "./schema/crm-deals"
export * from "./schema/crm-email-connections"
export * from "./schema/crm-events"

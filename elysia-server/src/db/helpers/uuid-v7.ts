import { sql } from "drizzle-orm"
import { uuid } from "drizzle-orm/pg-core"

// PG 18+ native uuidv7() — monotonic by creation time, ~20% smaller index than uuid v4.
export const uuidV7 = (name: string) => uuid(name).default(sql`uuidv7()`)

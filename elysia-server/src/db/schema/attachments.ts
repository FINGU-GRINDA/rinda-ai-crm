import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

// Entity types that can have attachments
export const attachmentEntityTypeEnum = pgEnum("attachment_entity_type", [
  "customer",
  "proposal",
  "email",
  "meeting",
  "slack_message",
  "contact",
  "prospect",
  "enrichment",
])

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type"), // MIME type: application/pdf, image/jpeg, etc.
    fileSize: integer("file_size"), // Size in bytes
    fileUrl: text("file_url").notNull(), // Storage URL (S3, cloud storage, or local path)
    entityType: attachmentEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(), // ID of the related entity
    uploadedBy: text("uploaded_by"), // Optional: user/source tracking
    metadata: text("metadata"), // JSON field for extra data (image dimensions, PDF page count, etc.)
    description: text("description"), // Optional description/notes about the file
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Composite index for efficient lookups by entity
    index("idx_attachments_entity").on(table.entityType, table.entityId),
    index("idx_attachments_entity_id").on(table.entityId),
    index("idx_attachments_created_at").on(table.createdAt),
  ],
)

export type Attachment = typeof attachments.$inferSelect
export type NewAttachment = typeof attachments.$inferInsert

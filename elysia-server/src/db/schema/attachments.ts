import { bigint, index, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core"

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
    id: text("id").primaryKey(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type"), // MIME type: application/pdf, image/jpeg, etc.
    fileSize: integer("file_size"), // Size in bytes
    fileUrl: text("file_url").notNull(), // Storage URL (S3, cloud storage, or local path)
    entityType: attachmentEntityTypeEnum("entity_type").notNull(),
    entityId: text("entity_id").notNull(), // ID of the related entity
    uploadedBy: text("uploaded_by"), // Optional: user/source tracking
    metadata: text("metadata"), // JSON field for extra data (image dimensions, PDF page count, etc.)
    description: text("description"), // Optional description/notes about the file
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
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

import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

export const stageTypeEnum = pgEnum("pipeline_stage_type", ["open", "won", "lost"])

export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: integer("is_default").notNull().default(0),
    displayOrder: integer("display_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pipelines_workspace").on(table.workspaceId, table.displayOrder),
    uniqueIndex("idx_pipelines_workspace_name").on(table.workspaceId, table.name),
    index("idx_pipelines_workspace_default")
      .on(table.workspaceId, table.isDefault)
      .where(sql`${table.archivedAt} IS NULL`),
  ],
)

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Denormalized for RLS / faster filtering
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'open' | 'won' | 'lost' — immutable contract that powers analytics
    stageType: stageTypeEnum("stage_type").notNull().default("open"),
    displayOrder: integer("display_order").notNull(),
    defaultProbability: numeric("default_probability", { precision: 5, scale: 2 })
      .notNull()
      .default("0.00"),
    color: text("color").notNull().default("#6366f1"),
    // Alert threshold (days) — deal sitting longer is flagged as 'rotting'
    rottingDays: integer("rotting_days"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pipeline_stages_pipeline").on(table.pipelineId, table.displayOrder),
    index("idx_pipeline_stages_workspace").on(table.workspaceId),
    check(
      "pipeline_stages_probability_range",
      sql`${table.defaultProbability} >= 0 AND ${table.defaultProbability} <= 100`,
    ),
  ],
)

export type Pipeline = typeof pipelines.$inferSelect
export type NewPipeline = typeof pipelines.$inferInsert
export type PipelineStage = typeof pipelineStages.$inferSelect
export type NewPipelineStage = typeof pipelineStages.$inferInsert
export type StageType = (typeof stageTypeEnum.enumValues)[number]

// Default stage templates surfaced when a workspace is created.
// Users can customize freely from Day 1 (the contract is `stageType`, not the name).
export const DEFAULT_PIPELINE_TEMPLATES = {
  "b2b-saas": {
    name: "B2B SaaS Sales",
    stages: [
      { name: "Lead", stageType: "open" as const, defaultProbability: "10.00", color: "#94a3b8" },
      {
        name: "Qualified",
        stageType: "open" as const,
        defaultProbability: "25.00",
        color: "#60a5fa",
      },
      { name: "Demo", stageType: "open" as const, defaultProbability: "40.00", color: "#6366f1" },
      {
        name: "Proposal",
        stageType: "open" as const,
        defaultProbability: "60.00",
        color: "#a855f7",
      },
      {
        name: "Negotiation",
        stageType: "open" as const,
        defaultProbability: "80.00",
        color: "#f59e0b",
      },
      { name: "Won", stageType: "won" as const, defaultProbability: "100.00", color: "#10b981" },
      { name: "Lost", stageType: "lost" as const, defaultProbability: "0.00", color: "#ef4444" },
    ],
  },
  agency: {
    name: "Agency Pipeline",
    stages: [
      {
        name: "Inquiry",
        stageType: "open" as const,
        defaultProbability: "10.00",
        color: "#94a3b8",
      },
      {
        name: "Discovery",
        stageType: "open" as const,
        defaultProbability: "30.00",
        color: "#60a5fa",
      },
      {
        name: "Proposal Sent",
        stageType: "open" as const,
        defaultProbability: "55.00",
        color: "#a855f7",
      },
      {
        name: "Contract",
        stageType: "open" as const,
        defaultProbability: "80.00",
        color: "#f59e0b",
      },
      { name: "Won", stageType: "won" as const, defaultProbability: "100.00", color: "#10b981" },
      { name: "Lost", stageType: "lost" as const, defaultProbability: "0.00", color: "#ef4444" },
    ],
  },
  ecommerce: {
    name: "E-commerce / Wholesale",
    stages: [
      { name: "New", stageType: "open" as const, defaultProbability: "15.00", color: "#94a3b8" },
      {
        name: "Sample Sent",
        stageType: "open" as const,
        defaultProbability: "35.00",
        color: "#60a5fa",
      },
      {
        name: "Negotiation",
        stageType: "open" as const,
        defaultProbability: "65.00",
        color: "#f59e0b",
      },
      {
        name: "PO Received",
        stageType: "open" as const,
        defaultProbability: "90.00",
        color: "#a855f7",
      },
      { name: "Won", stageType: "won" as const, defaultProbability: "100.00", color: "#10b981" },
      { name: "Lost", stageType: "lost" as const, defaultProbability: "0.00", color: "#ef4444" },
    ],
  },
} as const

export type PipelineTemplateKey = keyof typeof DEFAULT_PIPELINE_TEMPLATES

import { and, asc, desc, eq, like, lte, or, sql } from "drizzle-orm"
import { db } from "../db"
import {
  type Customer,
  customerEnrichments,
  customers,
  type NewCustomer,
  proposals,
  scheduledFollowUps,
} from "../db/schema"
import { generateId } from "../utils/id-generator"

export interface CustomerQueryOptions {
  status?: string
  industry?: string
  search?: string
  limit?: number
  offset?: number
  orderBy?: string
  order?: "asc" | "desc"
}

export const customerRepository = {
  findAll: async (
    options: CustomerQueryOptions = {},
  ): Promise<{ data: Customer[]; count: number }> => {
    const { status, industry, search, limit = 100, offset = 0, orderBy, order = "desc" } = options

    // Build conditions
    const conditions = []
    if (status) {
      const validStatuses = ["prospect", "new", "contact", "negotiation", "won", "lost"] as const
      if (validStatuses.includes(status as (typeof validStatuses)[number])) {
        conditions.push(eq(customers.status, status as (typeof validStatuses)[number]))
      }
    }
    if (industry) {
      conditions.push(eq(customers.industry, industry))
    }
    if (search) {
      const searchPattern = `%${search}%`
      conditions.push(
        or(
          like(customers.name, searchPattern),
          like(customers.industry, searchPattern),
          like(customers.notes, searchPattern),
        ),
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(whereClause)

    // Build order clause
    const orderFunc = order === "asc" ? asc : desc
    const orderClause =
      orderBy === "name"
        ? orderFunc(customers.name)
        : orderBy === "updatedAt"
          ? orderFunc(customers.updatedAt)
          : orderBy === "lastFollowUpAt"
            ? orderFunc(customers.lastFollowUpAt)
            : orderFunc(customers.createdAt)

    // Get data
    const data = await db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset)

    return {
      data,
      count: countResult[0]?.count || 0,
    }
  },

  findById: async (id: string): Promise<Customer | null> => {
    const result = await db.select().from(customers).where(eq(customers.id, id))
    return result[0] || null
  },

  findByName: async (name: string): Promise<Customer | null> => {
    const result = await db.select().from(customers).where(eq(customers.name, name))
    return result[0] || null
  },

  findByStatus: async (status: NonNullable<Customer["status"]>): Promise<Customer[]> => {
    return db
      .select()
      .from(customers)
      .where(eq(customers.status, status))
      .orderBy(desc(customers.createdAt))
  },

  search: async (query: string): Promise<Customer[]> => {
    const searchPattern = `%${query}%`
    return db
      .select()
      .from(customers)
      .where(
        or(
          like(customers.name, searchPattern),
          like(customers.industry, searchPattern),
          like(customers.notes, searchPattern),
        ),
      )
      .orderBy(desc(customers.createdAt))
  },

  create: async (data: Partial<NewCustomer>): Promise<Customer> => {
    const id = generateId()
    const now = Date.now()
    const [customer] = await db
      .insert(customers)
      .values({
        id,
        name: data.name || "",
        website: data.website,
        industry: data.industry,
        notes: data.notes,
        status: data.status || "new",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!customer) throw new Error("Failed to create customer")
    return customer
  },

  update: async (id: string, data: Partial<NewCustomer>): Promise<Customer | null> => {
    const [customer] = await db
      .update(customers)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(customers.id, id))
      .returning()
    return customer || null
  },

  delete: async (id: string): Promise<boolean> => {
    const _result = await db.delete(customers).where(eq(customers.id, id))
    return true
  },

  markAsLost: async (id: string, reason: string): Promise<Customer | null> => {
    const [customer] = await db
      .update(customers)
      .set({
        status: "lost",
        lostReason: reason,
        lostAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(customers.id, id))
      .returning()
    return customer || null
  },

  updateFollowUp: async (id: string): Promise<Customer | null> => {
    const [customer] = await db
      .update(customers)
      .set({
        lastFollowUpAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(customers.id, id))
      .returning()
    return customer || null
  },

  getStats: async () => {
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(customers)

    const byStatus = await db
      .select({
        status: customers.status,
        count: sql<number>`count(*)::int`,
      })
      .from(customers)
      .groupBy(customers.status)

    // Get count of due follow-ups
    const now = Date.now()
    const dueFollowUpsResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(scheduledFollowUps)
      .where(
        and(eq(scheduledFollowUps.status, "pending"), lte(scheduledFollowUps.scheduledFor, now)),
      )

    // Get top 10 due follow-ups with customer info
    const dueFollowUps = await db
      .select({
        id: scheduledFollowUps.id,
        customerId: scheduledFollowUps.customerId,
        customerName: customers.name,
        scheduledFor: scheduledFollowUps.scheduledFor,
        type: scheduledFollowUps.type,
        content: scheduledFollowUps.content,
        priority: scheduledFollowUps.priority,
        reason: scheduledFollowUps.reason,
      })
      .from(scheduledFollowUps)
      .innerJoin(customers, eq(scheduledFollowUps.customerId, customers.id))
      .where(
        and(eq(scheduledFollowUps.status, "pending"), lte(scheduledFollowUps.scheduledFor, now)),
      )
      .orderBy(asc(scheduledFollowUps.scheduledFor))
      .limit(10)

    // Build countByStatus object with all statuses having at least 0
    const countByStatus: Record<string, number> = {
      prospect: 0,
      new: 0,
      contact: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
    }
    for (const s of byStatus) {
      if (s.status) countByStatus[s.status] = s.count
    }

    return {
      total: result[0]?.total || 0,
      countByStatus,
      dueFollowUpsCount: dueFollowUpsResult[0]?.count || 0,
      dueFollowUps,
    }
  },

  // Enrichment methods
  getEnrichment: async (customerId: string) => {
    const result = await db
      .select()
      .from(customerEnrichments)
      .where(eq(customerEnrichments.customerId, customerId))
      .orderBy(desc(customerEnrichments.createdAt))
      .limit(1)
    return result[0] || null
  },

  saveEnrichment: async (
    customerId: string,
    data: {
      summary?: string
      ceo?: string
      foundedYear?: string
      recentNews?: string
      competitors?: string
      salesOpportunity?: string
      sources?: string
    },
  ) => {
    const [enrichment] = await db
      .insert(customerEnrichments)
      .values({
        customerId,
        ...data,
        createdAt: Date.now(),
      })
      .returning()

    // Update customer's lastEnrichedAt
    await db
      .update(customers)
      .set({ lastEnrichedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(customers.id, customerId))

    return enrichment
  },

  // Proposal methods
  getProposals: async (customerId: string) => {
    return db
      .select()
      .from(proposals)
      .where(eq(proposals.customerId, customerId))
      .orderBy(desc(proposals.createdAt))
  },

  createProposal: async (
    customerId: string,
    data: { title: string; content: string; imageUrl?: string },
  ) => {
    const [proposal] = await db
      .insert(proposals)
      .values({
        id: generateId(),
        customerId,
        title: data.title,
        content: data.content,
        imageUrl: data.imageUrl,
        createdAt: Date.now(),
      })
      .returning()
    return proposal
  },
}

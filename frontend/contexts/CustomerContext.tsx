/**
 * CustomerContext
 * 전역 고객 데이터 상태 관리
 */

import { createContext, type ReactNode, useContext } from "react"
import { useCustomers } from "../hooks/useCustomers"
import type { Customer, CustomerStatus, EnrichedData, FollowUpAction, Proposal } from "../types"

interface CustomerContextType {
  // Data
  customers: Customer[]
  loading: boolean
  error: string | null

  // CRUD Operations
  fetchCustomers: () => Promise<void>
  addCustomer: (customer: Omit<Customer, "id" | "proposals">) => Promise<Customer | null>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<Customer | null>
  deleteCustomer: (id: string) => Promise<boolean>

  // Status
  updateCustomerStatus: (
    id: string,
    status: CustomerStatus,
    lostReason?: string,
  ) => Promise<Customer | null>

  // Enrichment
  saveEnrichment: (customerId: string, enrichment: EnrichedData) => Promise<Customer | null>

  // Proposals
  addProposal: (
    customerId: string,
    proposal: Omit<Proposal, "id" | "createdAt">,
  ) => Promise<Proposal | null>

  // Follow-ups
  addFollowUp: (
    customerId: string,
    followUp: Omit<FollowUpAction, "id" | "createdAt">,
  ) => Promise<FollowUpAction | null>

  // Stats
  stats: any
  fetchStats: () => Promise<void>

  // Utilities
  getCustomerById: (id: string) => Customer | undefined
  refreshCustomer: (id: string) => Promise<Customer | null>
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

interface CustomerProviderProps {
  children: ReactNode
}

export function CustomerProvider({ children }: CustomerProviderProps) {
  const customersHook = useCustomers()

  return <CustomerContext.Provider value={customersHook}>{children}</CustomerContext.Provider>
}

export function useCustomerContext(): CustomerContextType {
  const context = useContext(CustomerContext)
  if (context === undefined) {
    throw new Error("useCustomerContext must be used within a CustomerProvider")
  }
  return context
}

export default CustomerContext

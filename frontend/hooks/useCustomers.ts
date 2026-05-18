/**
 * useCustomers Hook
 * 백엔드 API를 통한 고객 데이터 관리
 */

import { useCallback, useEffect, useState } from "react"
import { apiClient } from "../src/services/apiClient"
import { transformApiCustomer, transformApiProposal } from "../src/utils/apiTransformers"
import { isErrorResponse, isSuccessListResponse, isSuccessResponse } from "../src/utils/typeGuards"
import type { Customer, CustomerStatus, EnrichedData, FollowUpAction, Proposal } from "../types"

interface UseCustomersReturn {
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
  stats: CustomerStats | null
  fetchStats: () => Promise<void>
  // Utilities
  getCustomerById: (id: string) => Customer | undefined
  refreshCustomer: (id: string) => Promise<Customer | null>
}

interface CustomerStats {
  countByStatus: Record<CustomerStatus, number>
  dueFollowUpsCount: number
  dueFollowUps: Record<string, unknown>[]
}

export function useCustomers(): UseCustomersReturn {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<CustomerStats | null>(null)

  // 고객 목록 가져오기
  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.getCustomers({ limit: 500 })
      if (isSuccessListResponse(response)) {
        const transformedCustomers = response.data.map(transformApiCustomer)
        setCustomers(transformedCustomers)
      } else if (isErrorResponse(response)) {
        throw new Error(response.error)
      }
    } catch (err) {
      const error = err as Error
      console.error("Failed to fetch customers:", error)
      setError(error.message || "고객 목록을 불러오는데 실패했습니다.")
      // 에러 발생 시 빈 배열로 설정 (로컬 데이터 fallback 없음)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 고객 추가
  const addCustomer = useCallback(
    async (customerData: Omit<Customer, "id" | "proposals">): Promise<Customer | null> => {
      try {
        const response = await apiClient.createCustomer({
          name: customerData.name,
          website: customerData.website,
          industry: customerData.industry,
          notes: customerData.notes,
          status: customerData.status,
        })

        if (isSuccessResponse(response)) {
          const newCustomer = transformApiCustomer(response.data)
          setCustomers((prev) => [...prev, newCustomer])
          return newCustomer
        } else if (isErrorResponse(response)) {
          throw new Error(response.error)
        }
        return null
      } catch (err) {
        const error = err as Error
        console.error("Failed to add customer:", error)
        setError(error.message)
        return null
      }
    },
    [],
  )

  // 고객 업데이트
  const updateCustomer = useCallback(
    async (id: string, updates: Partial<Customer>): Promise<Customer | null> => {
      try {
        const response = await apiClient.updateCustomer(id, updates)

        if (isSuccessResponse(response)) {
          const updatedCustomer = transformApiCustomer(response.data)
          setCustomers((prev) => prev.map((c) => (c.id === id ? updatedCustomer : c)))
          return updatedCustomer
        } else if (isErrorResponse(response)) {
          throw new Error(response.error)
        }
        return null
      } catch (err) {
        const error = err as Error
        console.error("Failed to update customer:", error)
        setError(error.message)
        return null
      }
    },
    [],
  )

  // 고객 삭제
  const deleteCustomer = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiClient.deleteCustomer(id)

      if (isSuccessResponse(response)) {
        setCustomers((prev) => prev.filter((c) => c.id !== id))
        return true
      } else if (isErrorResponse(response)) {
        throw new Error(response.error)
      }
      return false
    } catch (err) {
      const error = err as Error
      console.error("Failed to delete customer:", error)
      setError(error.message)
      return false
    }
  }, [])

  // 고객 상태 업데이트
  const updateCustomerStatus = useCallback(
    async (id: string, status: CustomerStatus, lostReason?: string): Promise<Customer | null> => {
      try {
        const response = await apiClient.updateCustomerStatus(id, status, lostReason)

        if (isSuccessResponse(response)) {
          const updatedCustomer = transformApiCustomer(response.data)
          setCustomers((prev) => prev.map((c) => (c.id === id ? updatedCustomer : c)))
          return updatedCustomer
        } else if (isErrorResponse(response)) {
          throw new Error(response.error)
        }
        return null
      } catch (err) {
        const error = err as Error
        console.error("Failed to update customer status:", error)
        setError(error.message)
        return null
      }
    },
    [],
  )

  // Enrichment 저장
  const saveEnrichment = useCallback(
    async (customerId: string, enrichment: EnrichedData): Promise<Customer | null> => {
      try {
        const response = await apiClient.saveCustomerEnrichment(
          customerId,
          enrichment as unknown as Record<string, unknown>,
        )

        if (isSuccessResponse(response)) {
          const updatedCustomer = transformApiCustomer(response.data)
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? {
                    ...updatedCustomer,
                    enrichedData: enrichment,
                    lastEnrichedAt: new Date().toISOString(),
                  }
                : c,
            ),
          )
          return updatedCustomer
        } else if (isErrorResponse(response)) {
          throw new Error(response.error)
        }
        return null
      } catch (err) {
        const error = err as Error
        console.error("Failed to save enrichment:", error)
        setError(error.message)
        return null
      }
    },
    [],
  )

  // 제안서 추가
  const addProposal = useCallback(
    async (
      customerId: string,
      proposal: Omit<Proposal, "id" | "createdAt">,
    ): Promise<Proposal | null> => {
      try {
        const response = await apiClient.createCustomerProposal(customerId, proposal)

        if (isSuccessResponse(response)) {
          const newProposal = transformApiProposal(response.data)

          setCustomers((prev) =>
            prev.map((c) => {
              if (c.id === customerId) {
                return {
                  ...c,
                  proposals: [newProposal, ...c.proposals],
                }
              }
              return c
            }),
          )

          return newProposal
        } else if (isErrorResponse(response)) {
          throw new Error(response.error)
        }
        return null
      } catch (err) {
        const error = err as Error
        console.error("Failed to add proposal:", error)
        setError(error.message)
        return null
      }
    },
    [],
  )

  // Follow-up 추가
  const addFollowUp = useCallback(
    async (
      customerId: string,
      followUp: Omit<FollowUpAction, "id" | "createdAt">,
    ): Promise<FollowUpAction | null> => {
      try {
        const response = await apiClient.createCustomerFollowUp(customerId, {
          type: followUp.type,
          content: followUp.content,
        })

        if (isSuccessResponse(response)) {
          const newFollowUp: FollowUpAction = {
            id: (response.data as unknown as Record<string, unknown>).id as string,
            type: (response.data as unknown as Record<string, unknown>).type as
              | "email"
              | "call"
              | "meeting"
              | "message",
            content: (response.data as unknown as Record<string, unknown>).content as string,
            createdAt: (response.data as unknown as Record<string, unknown>).createdAt as string,
            status:
              ((response.data as unknown as Record<string, unknown>).status as
                | "planned"
                | "completed"
                | "cancelled") || "completed",
          }

          setCustomers((prev) =>
            prev.map((c) => {
              if (c.id === customerId) {
                return {
                  ...c,
                  followUpHistory: [newFollowUp, ...(c.followUpHistory || [])],
                  lastFollowUpAt: new Date().toISOString(),
                }
              }
              return c
            }),
          )

          return newFollowUp
        } else if (isErrorResponse(response)) {
          throw new Error(response.error)
        }
        return null
      } catch (err) {
        const error = err as Error
        console.error("Failed to add follow-up:", error)
        setError(error.message)
        return null
      }
    },
    [],
  )

  // 통계 가져오기
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.getCustomerStats()

      if (isSuccessResponse(response)) {
        setStats(response.data as unknown as CustomerStats)
      }
    } catch (err) {
      const error = err as Error
      console.error("Failed to fetch stats:", error)
    }
  }, [])

  // ID로 고객 찾기
  const getCustomerById = useCallback(
    (id: string): Customer | undefined => {
      return customers.find((c) => c.id === id)
    },
    [customers],
  )

  // 특정 고객 새로고침
  const refreshCustomer = useCallback(async (id: string): Promise<Customer | null> => {
    try {
      const response = await apiClient.getCustomer(id)

      if (isSuccessResponse(response)) {
        const updatedCustomer = transformApiCustomer(response.data)
        setCustomers((prev) => prev.map((c) => (c.id === id ? updatedCustomer : c)))
        return updatedCustomer
      }
      return null
    } catch (err) {
      const error = err as Error
      console.error("Failed to refresh customer:", error)
      return null
    }
  }, [])

  // 초기 로드
  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  return {
    customers,
    loading,
    error,
    fetchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    updateCustomerStatus,
    saveEnrichment,
    addProposal,
    addFollowUp,
    stats,
    fetchStats,
    getCustomerById,
    refreshCustomer,
  }
}

export default useCustomers

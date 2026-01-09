/**
 * useCustomers Hook
 * 백엔드 API를 통한 고객 데이터 관리
 */

import { useState, useEffect, useCallback } from 'react';
import { Customer, CustomerStatus, Proposal, FollowUpAction, EnrichedData } from '../types';
import { apiClient } from '../src/services/apiClient';

interface UseCustomersReturn {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  // CRUD Operations
  fetchCustomers: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'proposals'>) => Promise<Customer | null>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<Customer | null>;
  deleteCustomer: (id: string) => Promise<boolean>;
  // Status
  updateCustomerStatus: (id: string, status: CustomerStatus, lostReason?: string) => Promise<Customer | null>;
  // Enrichment
  saveEnrichment: (customerId: string, enrichment: EnrichedData) => Promise<Customer | null>;
  // Proposals
  addProposal: (customerId: string, proposal: Omit<Proposal, 'id' | 'createdAt'>) => Promise<Proposal | null>;
  // Follow-ups
  addFollowUp: (customerId: string, followUp: Omit<FollowUpAction, 'id' | 'createdAt'>) => Promise<FollowUpAction | null>;
  // Stats
  stats: CustomerStats | null;
  fetchStats: () => Promise<void>;
  // Utilities
  getCustomerById: (id: string) => Customer | undefined;
  refreshCustomer: (id: string) => Promise<Customer | null>;
}

interface CustomerStats {
  countByStatus: Record<CustomerStatus, number>;
  dueFollowUpsCount: number;
  dueFollowUps: any[];
}

// API 응답을 프론트엔드 Customer 타입으로 변환
function transformApiCustomer(apiCustomer: any): Customer {
  return {
    id: apiCustomer.id,
    name: apiCustomer.name,
    website: apiCustomer.website || '',
    industry: apiCustomer.industry || '미분류',
    notes: apiCustomer.notes || '',
    status: apiCustomer.status || 'new',
    enrichedData: apiCustomer.enrichedData || apiCustomer.enrichment || undefined,
    proposals: apiCustomer.proposals || [],
    lastEnrichedAt: apiCustomer.lastEnrichedAt || apiCustomer.last_enriched_at,
    lostReason: apiCustomer.lostReason || apiCustomer.lost_reason,
    lostAt: apiCustomer.lostAt || apiCustomer.lost_at,
    lastFollowUpAt: apiCustomer.lastFollowUpAt || apiCustomer.last_follow_up_at,
    followUpHistory: apiCustomer.followUpHistory || [],
    contacts: apiCustomer.contacts || [],
    meetingSummaries: apiCustomer.meetingSummaries || [],
  };
}

export function useCustomers(): UseCustomersReturn {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);

  // 고객 목록 가져오기
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getCustomers({ limit: 500 }) as any;
      if (response.success && response.data) {
        const transformedCustomers = response.data.map(transformApiCustomer);
        setCustomers(transformedCustomers);
      } else {
        throw new Error(response.error || '고객 목록을 불러오는데 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Failed to fetch customers:', err);
      setError(err.message || '고객 목록을 불러오는데 실패했습니다.');
      // 에러 발생 시 빈 배열로 설정 (로컬 데이터 fallback 없음)
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 고객 추가
  const addCustomer = useCallback(async (
    customerData: Omit<Customer, 'id' | 'proposals'>
  ): Promise<Customer | null> => {
    try {
      const response = await apiClient.createCustomer({
        name: customerData.name,
        website: customerData.website,
        industry: customerData.industry,
        notes: customerData.notes,
        status: customerData.status,
      }) as any;

      if (response.success && response.data) {
        const newCustomer = transformApiCustomer(response.data);
        setCustomers(prev => [...prev, newCustomer]);
        return newCustomer;
      }
      throw new Error(response.error || '고객 추가에 실패했습니다.');
    } catch (err: any) {
      console.error('Failed to add customer:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // 고객 업데이트
  const updateCustomer = useCallback(async (
    id: string,
    updates: Partial<Customer>
  ): Promise<Customer | null> => {
    try {
      const response = await apiClient.updateCustomer(id, updates) as any;

      if (response.success && response.data) {
        const updatedCustomer = transformApiCustomer(response.data);
        setCustomers(prev => prev.map(c => c.id === id ? updatedCustomer : c));
        return updatedCustomer;
      }
      throw new Error(response.error || '고객 업데이트에 실패했습니다.');
    } catch (err: any) {
      console.error('Failed to update customer:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // 고객 삭제
  const deleteCustomer = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiClient.deleteCustomer(id) as any;

      if (response.success) {
        setCustomers(prev => prev.filter(c => c.id !== id));
        return true;
      }
      throw new Error(response.error || '고객 삭제에 실패했습니다.');
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // 고객 상태 업데이트
  const updateCustomerStatus = useCallback(async (
    id: string,
    status: CustomerStatus,
    lostReason?: string
  ): Promise<Customer | null> => {
    try {
      const response = await apiClient.updateCustomerStatus(id, status, lostReason) as any;

      if (response.success && response.data) {
        const updatedCustomer = transformApiCustomer(response.data);
        setCustomers(prev => prev.map(c => c.id === id ? updatedCustomer : c));
        return updatedCustomer;
      }
      throw new Error(response.error || '상태 업데이트에 실패했습니다.');
    } catch (err: any) {
      console.error('Failed to update customer status:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // Enrichment 저장
  const saveEnrichment = useCallback(async (
    customerId: string,
    enrichment: EnrichedData
  ): Promise<Customer | null> => {
    try {
      const response = await apiClient.saveCustomerEnrichment(customerId, enrichment) as any;

      if (response.success && response.data) {
        const updatedCustomer = transformApiCustomer(response.data);
        setCustomers(prev => prev.map(c => c.id === customerId ? {
          ...updatedCustomer,
          enrichedData: enrichment,
          lastEnrichedAt: Date.now()
        } : c));
        return updatedCustomer;
      }
      throw new Error(response.error || 'AI 분석 저장에 실패했습니다.');
    } catch (err: any) {
      console.error('Failed to save enrichment:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // 제안서 추가
  const addProposal = useCallback(async (
    customerId: string,
    proposal: Omit<Proposal, 'id' | 'createdAt'>
  ): Promise<Proposal | null> => {
    try {
      const response = await apiClient.createCustomerProposal(customerId, proposal) as any;

      if (response.success && response.data) {
        const newProposal: Proposal = {
          id: response.data.id,
          title: response.data.title,
          content: response.data.content,
          imageUrl: response.data.imageUrl || response.data.image_url,
          createdAt: response.data.createdAt || response.data.created_at || Date.now(),
        };

        setCustomers(prev => prev.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              proposals: [newProposal, ...c.proposals]
            };
          }
          return c;
        }));

        return newProposal;
      }
      throw new Error(response.error || '제안서 저장에 실패했습니다.');
    } catch (err: any) {
      console.error('Failed to add proposal:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // Follow-up 추가
  const addFollowUp = useCallback(async (
    customerId: string,
    followUp: Omit<FollowUpAction, 'id' | 'createdAt'>
  ): Promise<FollowUpAction | null> => {
    try {
      const response = await apiClient.createCustomerFollowUp(customerId, {
        type: followUp.type,
        content: followUp.content,
      }) as any;

      if (response.success && response.data) {
        const newFollowUp: FollowUpAction = {
          id: response.data.id,
          type: response.data.type,
          content: response.data.content,
          createdAt: response.data.createdAt || response.data.created_at || Date.now(),
          status: response.data.status || 'completed',
        };

        setCustomers(prev => prev.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              followUpHistory: [newFollowUp, ...(c.followUpHistory || [])],
              lastFollowUpAt: Date.now()
            };
          }
          return c;
        }));

        return newFollowUp;
      }
      throw new Error(response.error || 'Follow-up 저장에 실패했습니다.');
    } catch (err: any) {
      console.error('Failed to add follow-up:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // 통계 가져오기
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.getCustomerStats() as any;

      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // ID로 고객 찾기
  const getCustomerById = useCallback((id: string): Customer | undefined => {
    return customers.find(c => c.id === id);
  }, [customers]);

  // 특정 고객 새로고침
  const refreshCustomer = useCallback(async (id: string): Promise<Customer | null> => {
    try {
      const response = await apiClient.getCustomer(id) as any;

      if (response.success && response.data) {
        const updatedCustomer = transformApiCustomer(response.data);
        setCustomers(prev => prev.map(c => c.id === id ? updatedCustomer : c));
        return updatedCustomer;
      }
      return null;
    } catch (err: any) {
      console.error('Failed to refresh customer:', err);
      return null;
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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
  };
}

export default useCustomers;

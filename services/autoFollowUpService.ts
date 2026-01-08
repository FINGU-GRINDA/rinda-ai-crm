import { Customer, ScheduledFollowUp, FollowUpAction, FollowUpStats, FollowUpFilterOptions, FollowUpType, FollowUpPriority } from '../types';
import { GoogleGenAI } from '@google/genai';
import { getUpcomingMeetings } from './calendarIntegrationService';
import GeminiAPIManager from './geminiApiManager';

// Gemini API 인스턴스 가져오기 (싱글톤)
const getAi = () => GeminiAPIManager.getInstance().getAiInstance();

// Scheduled Follow-ups Storage
const SCHEDULED_FOLLOWUPS_KEY = 'rinda_scheduled_followups';

// Get all scheduled follow-ups
export const getScheduledFollowUps = (): ScheduledFollowUp[] => {
  const stored = localStorage.getItem(SCHEDULED_FOLLOWUPS_KEY);
  return stored ? JSON.parse(stored) : [];
};

// Save scheduled follow-up
export const saveScheduledFollowUp = (followUp: ScheduledFollowUp): void => {
  const existing = getScheduledFollowUps();
  const index = existing.findIndex(f => f.id === followUp.id);
  
  if (index >= 0) {
    existing[index] = followUp;
  } else {
    existing.push(followUp);
  }
  
  localStorage.setItem(SCHEDULED_FOLLOWUPS_KEY, JSON.stringify(existing));
};

// Delete scheduled follow-up
export const deleteScheduledFollowUp = (followUpId: string): void => {
  const existing = getScheduledFollowUps();
  const filtered = existing.filter(f => f.id !== followUpId);
  localStorage.setItem(SCHEDULED_FOLLOWUPS_KEY, JSON.stringify(filtered));
};

// Calculate optimal follow-up timing for a customer
export const calculateOptimalFollowUpTiming = async (
  customer: Customer
): Promise<{ days: number; reason: string; priority: 'high' | 'medium' | 'low' }> => {
  const modelId = "gemini-3-flash-preview";
  
  const now = Date.now();
  const lastContact = customer.lastFollowUpAt || customer.lastEnrichedAt || 0;
  const daysSinceLastContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
  
  const context = `
    고객사: ${customer.name}
    산업: ${customer.industry}
    현재 상태: ${customer.status}
    마지막 접촉: ${lastContact > 0 ? `${daysSinceLastContact}일 전` : '없음'}
    메모: ${customer.notes ? customer.notes.substring(0, 500) : '없음'}
    ${customer.enrichedData ? `
    회사 요약: ${customer.enrichedData.summary}
    세일즈 기회: ${customer.enrichedData.salesOpportunity}
    ` : ''}
  `;

  const prompt = `
    다음 고객에 대한 최적의 Follow-up 시기를 계산해주세요.
    
    ${context}
    
    다음을 고려하여 판단해주세요:
    - 고객의 현재 영업 단계
    - 마지막 접촉으로부터 경과 시간
    - 고객의 특성과 산업
    - 세일즈 기회의 긴급성
    
    JSON 형식으로 반환:
    {
      "days": 숫자 (0 = 즉시, 1-7 = 며칠 후, 14 = 2주 후, 30 = 한 달 후),
      "reason": "시기 선택 이유",
      "priority": "high" | "medium" | "low"
    }
  `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    // Validate and set defaults
    let days = result.days ?? 7;
    if (days < 0) days = 0;
    if (days > 90) days = 90;
    
    return {
      days,
      reason: result.reason || '정기적인 Follow-up이 필요합니다.',
      priority: result.priority || 'medium'
    };
  } catch (error) {
    console.error('Follow-up timing calculation failed:', error);
    
    // Fallback logic
    let days = 7;
    let priority: 'high' | 'medium' | 'low' = 'medium';
    
    if (customer.status === 'negotiation') {
      days = 3;
      priority = 'high';
    } else if (customer.status === 'contact') {
      days = 5;
      priority = 'medium';
    } else if (customer.status === 'new') {
      days = 2;
      priority = 'high';
    } else if (daysSinceLastContact > 30) {
      days = 0; // Immediate
      priority = 'high';
    }
    
    return {
      days,
      reason: `고객 상태(${customer.status})와 마지막 접촉(${daysSinceLastContact}일 전)을 고려한 Follow-up 시기입니다.`,
      priority
    };
  }
};

// Determine follow-up type based on customer context
export const determineFollowUpType = async (
  customer: Customer
): Promise<'email' | 'call' | 'meeting' | 'message'> => {
  const modelId = "gemini-3-flash-preview";
  
  const prompt = `
    다음 고객에게 어떤 방식으로 Follow-up하는 것이 가장 적절한지 판단해주세요.
    
    고객사: ${customer.name}
    상태: ${customer.status}
    메모: ${customer.notes ? customer.notes.substring(0, 300) : '없음'}
    
    다음 중 하나를 선택: email, call, meeting, message

    JSON 형식: { "type": "email" | "call" | "meeting" | "message" }
  `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || '{}');
    const type = result.type || 'email';
    
    if (['email', 'call', 'meeting', 'message'].includes(type)) {
      return type as 'email' | 'call' | 'meeting' | 'message';
    }
  } catch (error) {
    console.error('Follow-up type determination failed:', error);
  }
  
  // Fallback
  if (customer.status === 'negotiation') {
    return 'call';
  } else if (customer.status === 'new') {
    return 'email';
  }
  return 'email';
};

// Generate follow-up content
export const generateFollowUpContent = async (
  customer: Customer,
  type: 'email' | 'call' | 'meeting' | 'message'
): Promise<string> => {
  const modelId = "gemini-3-flash-preview";
  
  const context = `
    고객사: ${customer.name}
    산업: ${customer.industry}
    상태: ${customer.status}
    메모: ${customer.notes || '없음'}
    ${customer.enrichedData ? `
    세일즈 기회: ${customer.enrichedData.salesOpportunity}
    ` : ''}
  `;

  const prompt = `
    다음 고객에게 보낼 ${type === 'email' ? '이메일' : type === 'call' ? '전화' : type === 'meeting' ? '미팅' : '메시지'} 내용을 작성해주세요.
    
    ${context}

    전문적이고 친근한 톤으로, 간결하게 작성해주세요 (100-200자).
  `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt
    });

    return response.text || `${customer.name}와의 Follow-up이 필요합니다.`;
  } catch (error) {
    console.error('Follow-up content generation failed:', error);
    return `${customer.name}와의 Follow-up이 필요합니다.`;
  }
};

// Schedule follow-up for a customer
export const scheduleFollowUp = async (
  customer: Customer
): Promise<ScheduledFollowUp> => {
  const timing = await calculateOptimalFollowUpTiming(customer);
  const type = await determineFollowUpType(customer);
  const content = await generateFollowUpContent(customer, type);
  
  const scheduledFor = Date.now() + timing.days * 24 * 60 * 60 * 1000;
  
  const followUp: ScheduledFollowUp = {
    id: `followup_${Date.now()}_${customer.id}`,
    customerId: customer.id,
    scheduledFor,
    type,
    content,
    status: 'pending',
    createdAt: Date.now(),
    priority: timing.priority,
    reason: timing.reason
  };
  
  saveScheduledFollowUp(followUp);
  return followUp;
};

// Get due follow-ups (should be executed now)
export const getDueFollowUps = (): ScheduledFollowUp[] => {
  const now = Date.now();
  const all = getScheduledFollowUps();
  
  return all.filter(f => 
    f.status === 'pending' && 
    f.scheduledFor <= now
  ).sort((a, b) => {
    // Sort by priority first, then by time
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    return a.scheduledFor - b.scheduledFor;
  });
};

// Get upcoming follow-ups
export const getUpcomingFollowUps = (daysAhead: number = 7): ScheduledFollowUp[] => {
  const now = Date.now();
  const endTime = now + daysAhead * 24 * 60 * 60 * 1000;
  const all = getScheduledFollowUps();
  
  return all.filter(f => 
    f.status === 'pending' && 
    f.scheduledFor > now && 
    f.scheduledFor <= endTime
  ).sort((a, b) => a.scheduledFor - b.scheduledFor);
};

// Check if customer has upcoming meeting that might affect follow-up timing
export const adjustFollowUpForMeetings = async (
  customer: Customer,
  followUp: ScheduledFollowUp
): Promise<ScheduledFollowUp | null> => {
  try {
    const meetings = await getUpcomingMeetings(customer.id, 14);
    
    // If there's a meeting within 2 days of scheduled follow-up, adjust
    for (const meeting of meetings) {
      const meetingTime = meeting.startTime;
      const followUpTime = followUp.scheduledFor;
      const diffDays = Math.abs(meetingTime - followUpTime) / (1000 * 60 * 60 * 24);
      
      if (diffDays <= 2) {
        // Reschedule follow-up to after meeting
        const adjustedFollowUp: ScheduledFollowUp = {
          ...followUp,
          scheduledFor: meeting.endTime + 24 * 60 * 60 * 1000, // 1 day after meeting
          reason: `미팅(${new Date(meeting.startTime).toLocaleDateString('ko-KR')}) 이후 Follow-up으로 조정되었습니다.`
        };
        
        saveScheduledFollowUp(adjustedFollowUp);
        return adjustedFollowUp;
      }
    }
  } catch (error) {
    console.error('Meeting adjustment failed:', error);
  }
  
  return null;
};

// Auto-schedule follow-ups for all customers
export const autoScheduleFollowUps = async (
  customers: Customer[]
): Promise<ScheduledFollowUp[]> => {
  const scheduled: ScheduledFollowUp[] = [];
  
  for (const customer of customers) {
    // Skip if already has pending follow-up
    const existing = getScheduledFollowUps().find(
      f => f.customerId === customer.id && f.status === 'pending'
    );
    
    if (existing) continue;
    
    // Skip lost deals
    if (customer.status === 'lost') continue;
    
    // Skip won deals (unless recently won)
    if (customer.status === 'won') {
      const daysSinceWon = customer.lastFollowUpAt 
        ? Math.floor((Date.now() - customer.lastFollowUpAt) / (1000 * 60 * 60 * 24))
        : 999;
      if (daysSinceWon > 30) continue;
    }
    
    try {
      const followUp = await scheduleFollowUp(customer);
      scheduled.push(followUp);
      
      // Adjust for meetings if needed
      await adjustFollowUpForMeetings(customer, followUp);
    } catch (error) {
      console.error(`Failed to schedule follow-up for ${customer.name}:`, error);
    }
  }
  
  return scheduled;
};

// Complete a scheduled follow-up with optional note
export const completeScheduledFollowUp = (
  followUpId: string,
  note?: string
): ScheduledFollowUp | null => {
  const existing = getScheduledFollowUps();
  const index = existing.findIndex(f => f.id === followUpId);

  if (index < 0) return null;

  const updated: ScheduledFollowUp = {
    ...existing[index],
    status: 'completed',
    completedAt: Date.now(),
    completedNote: note || ''
  };

  existing[index] = updated;
  localStorage.setItem(SCHEDULED_FOLLOWUPS_KEY, JSON.stringify(existing));

  return updated;
};

// Update a scheduled follow-up
export const updateScheduledFollowUp = (
  followUpId: string,
  updates: Partial<ScheduledFollowUp>
): ScheduledFollowUp | null => {
  const existing = getScheduledFollowUps();
  const index = existing.findIndex(f => f.id === followUpId);

  if (index < 0) return null;

  const updated: ScheduledFollowUp = {
    ...existing[index],
    ...updates
  };

  existing[index] = updated;
  localStorage.setItem(SCHEDULED_FOLLOWUPS_KEY, JSON.stringify(existing));

  return updated;
};

// Get follow-up statistics
export const getFollowUpStats = (): FollowUpStats => {
  const all = getScheduledFollowUps();
  const now = Date.now();

  const pending = all.filter(f => f.status === 'pending' && f.scheduledFor > now);
  const overdue = all.filter(f => f.status === 'pending' && f.scheduledFor <= now);
  const completed = all.filter(f => f.status === 'completed');

  // Calculate average completion time
  const completionTimes = completed
    .filter(f => f.completedAt && f.scheduledFor)
    .map(f => (f.completedAt || 0) - f.scheduledFor);
  const avgCompletionTime = completionTimes.length > 0
    ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
    : 0;

  // Count by type
  const byType: Record<FollowUpType, number> = {
    email: all.filter(f => f.type === 'email').length,
    call: all.filter(f => f.type === 'call').length,
    meeting: all.filter(f => f.type === 'meeting').length,
    message: all.filter(f => f.type === 'message').length
  };

  // Count by priority
  const byPriority: Record<FollowUpPriority, number> = {
    high: all.filter(f => f.priority === 'high').length,
    medium: all.filter(f => f.priority === 'medium').length,
    low: all.filter(f => f.priority === 'low').length
  };

  return {
    total: all.length,
    pending: pending.length,
    completed: completed.length,
    overdue: overdue.length,
    completionRate: all.length > 0 ? (completed.length / all.length) * 100 : 0,
    avgCompletionTime,
    byType,
    byPriority
  };
};

// Filter follow-ups based on options
export const filterFollowUps = (
  followUps: ScheduledFollowUp[],
  filters: FollowUpFilterOptions,
  customers: Customer[]
): ScheduledFollowUp[] => {
  let result = [...followUps];
  const now = Date.now();

  // Filter by status
  if (filters.status && filters.status.length > 0) {
    result = result.filter(f => {
      // Special handling for 'overdue' which is a virtual status
      if (filters.status!.includes('pending') && f.status === 'pending' && f.scheduledFor > now) {
        return true;
      }
      if (filters.status!.includes('completed') && f.status === 'completed') {
        return true;
      }
      if (filters.status!.includes('cancelled') && f.status === 'cancelled') {
        return true;
      }
      return false;
    });
  }

  // Filter by priority
  if (filters.priority && filters.priority.length > 0) {
    result = result.filter(f => filters.priority!.includes(f.priority));
  }

  // Filter by type
  if (filters.type && filters.type.length > 0) {
    result = result.filter(f => filters.type!.includes(f.type));
  }

  // Filter by customer
  if (filters.customerId) {
    result = result.filter(f => f.customerId === filters.customerId);
  }

  // Filter by date range
  if (filters.dateRange) {
    result = result.filter(f =>
      f.scheduledFor >= filters.dateRange!.start &&
      f.scheduledFor <= filters.dateRange!.end
    );
  }

  // Filter by search query (customer name or content)
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase().trim();
    result = result.filter(f => {
      const customer = customers.find(c => c.id === f.customerId);
      const customerName = customer?.name?.toLowerCase() || '';
      const content = f.content?.toLowerCase() || '';
      const reason = f.reason?.toLowerCase() || '';

      return customerName.includes(query) || content.includes(query) || reason.includes(query);
    });
  }

  return result;
};

// Get overdue follow-ups
export const getOverdueFollowUps = (): ScheduledFollowUp[] => {
  const now = Date.now();
  const all = getScheduledFollowUps();

  return all.filter(f =>
    f.status === 'pending' &&
    f.scheduledFor <= now
  ).sort((a, b) => a.scheduledFor - b.scheduledFor);
};

// Get completed follow-ups
export const getCompletedFollowUps = (limit?: number): ScheduledFollowUp[] => {
  const all = getScheduledFollowUps();

  const completed = all.filter(f => f.status === 'completed')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  return limit ? completed.slice(0, limit) : completed;
};

// Get follow-ups for a specific customer
export const getCustomerFollowUps = (customerId: string): ScheduledFollowUp[] => {
  const all = getScheduledFollowUps();

  return all.filter(f => f.customerId === customerId)
    .sort((a, b) => b.scheduledFor - a.scheduledFor);
};

// Create a manual follow-up
export const createManualFollowUp = (
  customerId: string,
  data: {
    scheduledFor: number;
    type: FollowUpType;
    content?: string;
    priority: FollowUpPriority;
    reason: string;
  }
): ScheduledFollowUp => {
  const followUp: ScheduledFollowUp = {
    id: `followup_${Date.now()}_${customerId}`,
    customerId,
    scheduledFor: data.scheduledFor,
    type: data.type,
    content: data.content,
    status: 'pending',
    createdAt: Date.now(),
    priority: data.priority,
    reason: data.reason,
    isManuallyCreated: true
  };

  saveScheduledFollowUp(followUp);
  return followUp;
};


import { Customer, ContextualSuggestion, ScheduledFollowUp } from '../types';
import GeminiAPIManager from './geminiApiManager';
import { getDueFollowUps, getUpcomingFollowUps } from './autoFollowUpService';
import { getUpcomingMeetings } from './calendarIntegrationService';

const getAi = () => GeminiAPIManager.getInstance().getAiInstance();

// Contextual Suggestions Storage
const SUGGESTIONS_KEY = 'rinda_contextual_suggestions';

// Get all suggestions
export const getSuggestions = (): ContextualSuggestion[] => {
  const stored = localStorage.getItem(SUGGESTIONS_KEY);
  return stored ? JSON.parse(stored) : [];
};

// Save suggestion
export const saveSuggestion = (suggestion: ContextualSuggestion): void => {
  const existing = getSuggestions();
  
  // Avoid duplicates
  const isDuplicate = existing.some(s => 
    s.id === suggestion.id ||
    (s.type === suggestion.type && 
     s.customerId === suggestion.customerId &&
     Math.abs(s.createdAt - suggestion.createdAt) < 60000)
  );
  
  if (!isDuplicate) {
    existing.unshift(suggestion);
    // Keep last 100 suggestions
    const trimmed = existing.slice(0, 100);
    localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(trimmed));
  }
};

// Delete suggestion
export const deleteSuggestion = (suggestionId: string): void => {
  const existing = getSuggestions();
  const filtered = existing.filter(s => s.id !== suggestionId);
  localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(filtered));
};

// Analyze customer context and generate suggestions
export const analyzeCustomerContext = async (
  customer: Customer,
  allCustomers: Customer[]
): Promise<ContextualSuggestion[]> => {
  const suggestions: ContextualSuggestion[] = [];
  const now = Date.now();
  
  // Check for missing follow-up
  const lastContact = customer.lastFollowUpAt || customer.lastEnrichedAt || 0;
  const daysSinceLastContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
  
  if (daysSinceLastContact >= 3 && customer.status !== 'won' && customer.status !== 'lost') {
    suggestions.push({
      id: `suggest_followup_${customer.id}`,
      type: 'followup',
      title: 'Follow-up이 필요합니다',
      description: `${customer.name}와의 마지막 접촉이 ${daysSinceLastContact}일 전입니다. Follow-up 메시지를 생성할까요?`,
      customerId: customer.id,
      action: 'generate_followup',
      priority: daysSinceLastContact >= 7 ? 'high' : 'medium',
      createdAt: now
    });
  }
  
  // Check for missing enrichment
  if (!customer.enrichedData || (customer.lastEnrichedAt && (now - customer.lastEnrichedAt) > 30 * 24 * 60 * 60 * 1000)) {
    suggestions.push({
      id: `suggest_enrich_${customer.id}`,
      type: 'enrichment',
      title: '고객 정보 업데이트 필요',
      description: `${customer.name}의 정보가 오래되었거나 없습니다. 최신 정보를 수집할까요?`,
      customerId: customer.id,
      action: 'enrich_customer',
      priority: !customer.enrichedData ? 'high' : 'medium',
      createdAt: now
    });
  }
  
  // Check for missing proposal in negotiation stage
  if (customer.status === 'negotiation' && customer.proposals.length === 0) {
    suggestions.push({
      id: `suggest_proposal_${customer.id}`,
      type: 'proposal',
      title: '제안서 작성이 필요합니다',
      description: `${customer.name}가 제안서 검토 단계에 있지만 제안서가 없습니다. 제안서를 생성할까요?`,
      customerId: customer.id,
      action: 'generate_proposal',
      priority: 'high',
      createdAt: now
    });
  }
  
  // Check for upcoming meetings
  try {
    const meetings = await getUpcomingMeetings(customer.id, 3);
    if (meetings.length > 0) {
      const nextMeeting = meetings[0];
      const hoursUntil = (nextMeeting.startTime - now) / (1000 * 60 * 60);
      
      if (hoursUntil <= 48 && hoursUntil > 0) {
        suggestions.push({
          id: `suggest_meeting_prep_${customer.id}_${nextMeeting.id}`,
          type: 'meeting_prep',
          title: '미팅 준비가 필요합니다',
          description: `${customer.name}와의 미팅이 ${Math.floor(hoursUntil)}시간 후에 예정되어 있습니다. 미팅 준비 자료를 생성할까요?`,
          customerId: customer.id,
          action: 'generate_meeting_prep',
          priority: hoursUntil <= 24 ? 'high' : 'medium',
          createdAt: now
        });
      }
    }
  } catch (error) {
    console.error('Failed to check meetings for suggestions:', error);
  }
  
  // Check for risk signals using AI
  try {
    const riskSuggestion = await detectRiskSignals(customer, allCustomers);
    if (riskSuggestion) {
      suggestions.push(riskSuggestion);
    }
  } catch (error) {
    console.error('Risk detection failed:', error);
  }
  
  return suggestions;
};

// Detect risk signals using AI
export const detectRiskSignals = async (
  customer: Customer,
  allCustomers: Customer[]
): Promise<ContextualSuggestion | null> => {
  const modelId = "gemini-3-flash-preview";
  
  const now = Date.now();
  const lastContact = customer.lastFollowUpAt || customer.lastEnrichedAt || 0;
  const daysSinceLastContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
  
  const context = `
    고객사: ${customer.name}
    산업: ${customer.industry}
    현재 상태: ${customer.status}
    마지막 접촉: ${lastContact > 0 ? `${Math.floor((now - lastContact) / (1000 * 60 * 60 * 24))}일 전` : '없음'}
    메모: ${customer.notes ? customer.notes.substring(0, 500) : '없음'}
    ${customer.enrichedData ? `
    최근 뉴스: ${customer.enrichedData.recentNews.join(', ')}
    ` : ''}
  `;

  const prompt = `
    다음 고객에 대한 위험 신호가 있는지 분석해주세요.
    
    ${context}
    
    다음 상황을 위험 신호로 간주합니다:
    - 오랫동안 연락이 없는 경우 (30일 이상)
    - 경쟁사와의 관계가 보이는 경우
    - 부정적인 뉴스나 변화
    - 거래 단계가 멈춰있는 경우
    
    위험 신호가 감지되면 JSON 형식으로 반환:
    {
      "hasRisk": true,
      "riskReason": "위험 신호 이유",
      "priority": "high" | "medium"
    }
    
    위험 신호가 없으면:
    {
      "hasRisk": false
    }
  `;

  try {
    const response = await getAi().models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    if (result.hasRisk) {
      return {
        id: `suggest_risk_${customer.id}_${Date.now()}`,
        type: 'risk',
        title: '위험 신호 감지',
        description: `${customer.name}: ${result.riskReason}`,
        customerId: customer.id,
        action: 'review_customer',
        priority: result.priority || 'medium',
        createdAt: now
      };
    }
  } catch (error) {
    console.error('Risk detection failed:', error);
    
    // Fallback: check for obvious risk signals
    if (daysSinceLastContact >= 30 && customer.status !== 'won' && customer.status !== 'lost') {
      return {
        id: `suggest_risk_${customer.id}_${Date.now()}`,
        type: 'risk',
        title: '장기간 연락 없음',
        description: `${customer.name}와의 마지막 접촉이 ${daysSinceLastContact}일 전입니다. 상태를 확인해보세요.`,
        customerId: customer.id,
        action: 'review_customer',
        priority: 'medium',
        createdAt: now
      };
    }
  }
  
  return null;
};

// Generate suggestions for all customers
export const generateAllSuggestions = async (
  customers: Customer[]
): Promise<ContextualSuggestion[]> => {
  const allSuggestions: ContextualSuggestion[] = [];
  
  // Limit to active customers to avoid too many suggestions
  const activeCustomers = customers.filter(c => 
    c.status !== 'lost' && c.status !== 'won'
  ).slice(0, 50); // Process max 50 at a time
  
  for (const customer of activeCustomers) {
    try {
      const suggestions = await analyzeCustomerContext(customer, customers);
      allSuggestions.push(...suggestions);
      
      // Save each suggestion
      suggestions.forEach(s => saveSuggestion(s));
    } catch (error) {
      console.error(`Failed to generate suggestions for ${customer.name}:`, error);
    }
  }
  
  return allSuggestions;
};

// Get suggestions for a specific customer
export const getCustomerSuggestions = (customerId: string): ContextualSuggestion[] => {
  return getSuggestions().filter(s => s.customerId === customerId);
};

// Get high-priority suggestions
export const getHighPrioritySuggestions = (): ContextualSuggestion[] => {
  return getSuggestions().filter(s => s.priority === 'high').slice(0, 10);
};


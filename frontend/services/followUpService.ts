import { Customer } from "../types";
import { apiClient } from "../src/services/apiClient";

export interface FollowUpStrategy {
  recommendedTiming: string;
  approach: string;
  messageTone: string;
  keyPoints: string[];
  probability: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface FollowUpMessage {
  subject?: string;
  content: string;
  suggestedChannel: 'email' | 'call' | 'linkedin' | 'meeting';
}

// Lost Deal 분석 및 재접촉 전략 생성
export const analyzeLostDeal = async (
  customer: Customer,
  lostReason: string
): Promise<FollowUpStrategy> => {
  try {
    const response = await apiClient.generateFollowUpStrategy(customer.id, true);
    return (response as any).data as FollowUpStrategy;
  } catch (error) {
    console.error("Lost deal analysis failed:", error);
    throw error;
  }
};

// 잠재 고객에 대한 Follow Up 전략 생성
export const generateFollowUpStrategy = async (
  customer: Customer
): Promise<FollowUpStrategy> => {
  try {
    const response = await apiClient.generateFollowUpStrategy(customer.id, false);
    return (response as any).data as FollowUpStrategy;
  } catch (error) {
    console.error("Follow up strategy generation failed:", error);
    throw error;
  }
};

// 재접촉 메시지/이메일 초안 생성
export const generateFollowUpMessage = async (
  customer: Customer,
  strategy: FollowUpStrategy,
  isLostDeal: boolean = false
): Promise<FollowUpMessage> => {
  try {
    const response = await apiClient.generateFollowUpMessage(customer.id, strategy, isLostDeal);
    return (response as any).data as FollowUpMessage;
  } catch (error) {
    console.error("Follow up message generation failed:", error);
    throw error;
  }
};

// 최적의 재접촉 시점 제안
export const suggestFollowUpTiming = (
  customer: Customer,
  strategy: FollowUpStrategy
): { days: number; date: Date; reason: string } => {
  const now = Date.now();
  const lostAtTimestamp = customer.lostAt ? new Date(customer.lostAt).getTime() : now;
  const daysSinceLost = Math.floor((now - lostAtTimestamp) / (1000 * 60 * 60 * 24));
  
  let suggestedDays = 30; // 기본값
  
  // 전략의 recommendedTiming을 파싱하여 일수 계산
  if (strategy.recommendedTiming.includes('즉시') || strategy.recommendedTiming.includes('지금')) {
    suggestedDays = 0;
  } else if (strategy.recommendedTiming.includes('1주') || strategy.recommendedTiming.includes('7일')) {
    suggestedDays = 7;
  } else if (strategy.recommendedTiming.includes('2주') || strategy.recommendedTiming.includes('14일')) {
    suggestedDays = 14;
  } else if (strategy.recommendedTiming.includes('30일') || strategy.recommendedTiming.includes('한 달')) {
    suggestedDays = 30;
  } else if (strategy.recommendedTiming.includes('분기')) {
    suggestedDays = 90;
  }
  
  const suggestedDate = new Date(now + suggestedDays * 24 * 60 * 60 * 1000);
  
  return {
    days: suggestedDays,
    date: suggestedDate,
    reason: strategy.reasoning || strategy.recommendedTiming
  };
};


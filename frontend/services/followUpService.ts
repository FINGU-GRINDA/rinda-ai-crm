import { GoogleGenAI, Type } from "@google/genai";
import { Customer, EnrichedData } from "../types";
import GeminiAPIManager from './geminiApiManager';

// Gemini API 인스턴스 가져오기 (싱글톤)
const getAi = () => GeminiAPIManager.getInstance().getAiInstance();

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
  const modelId = "gemini-3-flash-preview";

  const context = `
    고객사: ${customer.name}
    산업: ${customer.industry}
    웹사이트: ${customer.website}
    거래 실패 사유: ${lostReason}
    내부 메모: ${customer.notes || '없음'}
    ${customer.enrichedData ? `
    회사 요약: ${customer.enrichedData.summary}
    최근 뉴스: ${customer.enrichedData.recentNews.join(", ")}
    경쟁사: ${customer.enrichedData.competitors.join(", ")}
    ` : ''}
  `;

  const prompt = `
    당신은 RINDA CRM의 세일즈 복구 전문가입니다.
    거래를 놓친 고객 "${customer.name}"에 대한 재접촉 전략을 분석해주세요.
    
    다음을 포함한 JSON 객체를 한국어로 반환해주세요:
    1. recommendedTiming: 최적의 재접촉 시기 (예: "30일 후", "다음 분기 초", "즉시")
    2. approach: 접근 방법 (예: "가치 중심 재제안", "경쟁사 대안 제시", "관계 회복")
    3. messageTone: 메시지 톤 (예: "전문적이고 공감적", "솔직하고 직접적")
    4. keyPoints: 재접촉 시 강조할 핵심 포인트 배열 (최대 5개)
    5. probability: 재접촉 성공 가능성 ('high', 'medium', 'low')
    6. reasoning: 전략 선택 이유
    
    실패 사유를 바탕으로 구체적이고 실행 가능한 전략을 제시해주세요.
  `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedTiming: { type: Type.STRING },
            approach: { type: Type.STRING },
            messageTone: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            probability: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["recommendedTiming", "approach", "messageTone", "keyPoints", "probability", "reasoning"]
        }
      }
    });

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    
    return {
      ...parsed,
      probability: parsed.probability || 'medium'
    } as FollowUpStrategy;
  } catch (error) {
    console.error("Lost deal analysis failed:", error);
    throw error;
  }
};

// 잠재 고객에 대한 Follow Up 전략 생성
export const generateFollowUpStrategy = async (
  customer: Customer
): Promise<FollowUpStrategy> => {
  const modelId = "gemini-3-flash-preview";

  const context = `
    잠재 고객: ${customer.name}
    산업: ${customer.industry}
    웹사이트: ${customer.website}
    현재 상태: ${customer.status}
    내부 메모: ${customer.notes || '없음'}
    ${customer.enrichedData ? `
    회사 요약: ${customer.enrichedData.summary}
    세일즈 기회: ${customer.enrichedData.salesOpportunity}
    최근 뉴스: ${customer.enrichedData.recentNews.join(", ")}
    ` : ''}
  `;

  const prompt = `
    당신은 RINDA CRM의 세일즈 전략가입니다.
    잠재 고객 "${customer.name}"에 대한 초기 접촉 및 Follow Up 전략을 수립해주세요.
    
    다음을 포함한 JSON 객체를 한국어로 반환해주세요:
    1. recommendedTiming: 최적의 접촉 시기 (예: "즉시", "1주일 후", "다음 달")
    2. approach: 접근 방법 (예: "가치 제안 중심", "니즈 탐색", "케이스 스터디 공유")
    3. messageTone: 메시지 톤 (예: "친근하고 전문적", "간결하고 직접적")
    4. keyPoints: 접촉 시 강조할 핵심 포인트 배열 (최대 5개)
    5. probability: 성공 가능성 ('high', 'medium', 'low')
    6. reasoning: 전략 선택 이유
    
    고객의 산업과 상황을 고려하여 맞춤형 전략을 제시해주세요.
  `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedTiming: { type: Type.STRING },
            approach: { type: Type.STRING },
            messageTone: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            probability: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["recommendedTiming", "approach", "messageTone", "keyPoints", "probability", "reasoning"]
        }
      }
    });

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    
    return {
      ...parsed,
      probability: parsed.probability || 'medium'
    } as FollowUpStrategy;
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
  const modelId = "gemini-3-flash-preview";

  const context = `
    고객사: ${customer.name}
    산업: ${customer.industry}
    ${isLostDeal ? `거래 실패 사유: ${customer.lostReason || '미상'}` : `현재 상태: ${customer.status}`}
    전략: ${strategy.approach}
    메시지 톤: ${strategy.messageTone}
    핵심 포인트: ${strategy.keyPoints.join(", ")}
    ${customer.enrichedData ? `
    회사 요약: ${customer.enrichedData.summary}
    ${isLostDeal ? '' : `세일즈 기회: ${customer.enrichedData.salesOpportunity}`}
    ` : ''}
  `;

  const prompt = `
    당신은 RINDA CRM의 세일즈 커뮤니케이션 전문가입니다.
    ${isLostDeal ? '거래를 놓친' : '잠재'} 고객 "${customer.name}"에게 보낼 ${isLostDeal ? '재접촉' : '초기 접촉'} 메시지를 작성해주세요.
    
    다음을 포함한 JSON 객체를 한국어로 반환해주세요:
    1. subject: 이메일 제목 (이메일인 경우)
    2. content: 메시지 본문 (전문적이고 설득력 있게, 200-300자)
    3. suggestedChannel: 권장 채널 ('email', 'call', 'linkedin', 'meeting')
    
    전략의 접근 방법과 톤을 반영하여, 고객의 관심을 끌고 다음 단계로 이어질 수 있는 메시지를 작성해주세요.
    ${isLostDeal ? '과거 거래 실패를 언급하되, 긍정적이고 재기회를 제시하는 방향으로 작성해주세요.' : ''}
  `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            content: { type: Type.STRING },
            suggestedChannel: { type: Type.STRING },
          },
          required: ["content", "suggestedChannel"]
        }
      }
    });

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText) as FollowUpMessage;
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
  const lostAt = customer.lostAt || now;
  const daysSinceLost = Math.floor((now - lostAt) / (1000 * 60 * 60 * 24));
  
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


import { AIMessage, Customer } from '../types';
import { enrichCustomerData, generateProposalStrategy, generateProposalCoverImage } from './geminiService';
import { ImageSize } from '../types';
import GeminiAPIManager from './geminiApiManager';

// Get AI instance from manager
const getAI = () => GeminiAPIManager.getInstance().getAiInstance();

// AI Assistant conversation storage
const AI_ASSISTANT_CONVERSATIONS_KEY = 'rinda_ai_assistant_conversations';

// Get conversation history
export const getConversationHistory = (sessionId: string = 'default'): AIMessage[] => {
  const stored = localStorage.getItem(`${AI_ASSISTANT_CONVERSATIONS_KEY}_${sessionId}`);
  return stored ? JSON.parse(stored) : [];
};

// Save message to conversation
export const saveMessage = (message: AIMessage, sessionId: string = 'default'): void => {
  const history = getConversationHistory(sessionId);
  history.push(message);

  // Keep last 100 messages
  const trimmed = history.slice(-100);
  localStorage.setItem(`${AI_ASSISTANT_CONVERSATIONS_KEY}_${sessionId}`, JSON.stringify(trimmed));
};

// Clear conversation history
export const clearConversationHistory = (sessionId: string = 'default'): void => {
  localStorage.removeItem(`${AI_ASSISTANT_CONVERSATIONS_KEY}_${sessionId}`);
};

// Parse user intent from message - using Gemini API directly
export const parseUserIntent = async (
  message: string,
  customers: Customer[]
): Promise<{
  intent: 'enrich' | 'proposal' | 'search' | 'analyze' | 'followup' | 'general';
  customerId?: string;
  customerName?: string;
  parameters?: Record<string, any>;
}> => {
  try {
    const ai = getAI();

    // Create customer names list for context
    const customerNames = customers.map(c => ({ id: c.id, name: c.name }));

    const prompt = `
사용자 메시지를 분석하여 의도를 파악해주세요.

사용자 메시지: "${message}"

등록된 고객 목록:
${customerNames.map(c => `- ${c.name} (ID: ${c.id})`).join('\n')}

다음 JSON 형식으로 응답해주세요:
{
  "intent": "enrich" | "proposal" | "search" | "analyze" | "followup" | "general",
  "customerId": "고객ID (해당하는 경우)",
  "customerName": "고객명 (해당하는 경우)",
  "parameters": {}
}

의도 설명:
- enrich: 고객 정보 분석/조사 요청 (예: "삼성전자 분석해줘", "테크플로우 정보 알려줘")
- proposal: 제안서 생성 요청 (예: "제안서 만들어줘", "삼성전자 제안서 작성해줘")
- search: 고객 검색 (예: "IT 고객 찾아줘", "삼성 검색")
- analyze: 통계/분석 요청 (예: "고객 통계 보여줘", "현황 분석해줘")
- followup: 후속 조치 관련 (예: "팔로업 필요한 고객", "연락해야 할 고객")
- general: 일반 대화

고객명이 메시지에 언급되면 해당 고객의 ID를 customerId에 포함하세요.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 512,
      }
    });

    const text = response.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent || 'general',
        customerId: parsed.customerId,
        customerName: parsed.customerName,
        parameters: parsed.parameters || {}
      };
    }

    return { intent: 'general' };
  } catch (error) {
    console.error('Intent parsing failed:', error);
    return { intent: 'general' };
  }
};

// Execute action based on intent
export const executeAction = async (
  intent: string,
  customerId: string | undefined,
  customers: Customer[],
  parameters?: Record<string, any>
): Promise<{ success: boolean; message: string; data?: any }> => {
  if (!customerId && (intent === 'enrich' || intent === 'proposal')) {
    return {
      success: false,
      message: '고객을 먼저 지정해주세요. 예: "삼성전자 분석해줘"'
    };
  }

  const customer = customerId ? customers.find(c => c.id === customerId) : null;

  switch (intent) {
    case 'enrich':
      if (!customer) {
        return { success: false, message: '고객을 찾을 수 없습니다.' };
      }

      try {
        const enrichedData = await enrichCustomerData(customer.name, customer.website);
        return {
          success: true,
          message: `${customer.name}의 정보를 성공적으로 수집했습니다.`,
          data: { enrichedData, customerId: customer.id }
        };
      } catch (error: any) {
        return {
          success: false,
          message: `정보 수집 중 오류가 발생했습니다: ${error.message}`
        };
      }

    case 'proposal':
      if (!customer) {
        return { success: false, message: '고객을 찾을 수 없습니다.' };
      }

      if (!customer.enrichedData) {
        return {
          success: false,
          message: '제안서를 생성하려면 먼저 고객 정보를 분석해주세요.'
        };
      }

      try {
        const proposalContent = await generateProposalStrategy(
          customer.name,
          customer.enrichedData,
          customer.notes || ''
        );

        const imageSize = (parameters?.imageSize as ImageSize) || ImageSize.Size_1K;
        const proposalImage = await generateProposalCoverImage(
          customer.name,
          customer.industry,
          customer.enrichedData.summary,
          imageSize
        );

        return {
          success: true,
          message: `${customer.name}에 대한 제안서를 생성했습니다.`,
          data: {
            proposal: {
              title: `${customer.name} 맞춤형 제안`,
              content: proposalContent,
              imageUrl: proposalImage
            },
            customerId: customer.id
          }
        };
      } catch (error: any) {
        return {
          success: false,
          message: `제안서 생성 중 오류가 발생했습니다: ${error.message}`
        };
      }

    case 'search':
      const searchTerm = parameters?.query || '';
      const matchingCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.website.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (matchingCustomers.length === 0) {
        return {
          success: false,
          message: `"${searchTerm}"에 해당하는 고객을 찾을 수 없습니다.`
        };
      }

      return {
        success: true,
        message: `${matchingCustomers.length}개의 고객을 찾았습니다.`,
        data: { customers: matchingCustomers }
      };

    case 'analyze':
      const total = customers.length;
      const byStatus = customers.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        success: true,
        message: `전체 ${total}개의 고객이 있습니다.`,
        data: {
          total,
          byStatus,
          enriched: customers.filter(c => c.enrichedData).length,
          proposals: customers.reduce((sum, c) => sum + c.proposals.length, 0)
        }
      };

    case 'followup':
      const followUpCustomers = customers.filter(c =>
        c.status !== 'lost' && c.status !== 'won'
      );

      return {
        success: true,
        message: `Follow-up이 필요한 고객은 ${followUpCustomers.length}개입니다.`,
        data: { customers: followUpCustomers }
      };

    default:
      return {
        success: false,
        message: '이해하지 못했습니다. 다시 말씀해주세요.'
      };
  }
};

// Generate AI assistant response - using Gemini API directly
export const generateResponse = async (
  userMessage: string,
  customers: Customer[],
  conversationHistory: AIMessage[] = [],
  sessionId: string = 'default'
): Promise<AIMessage> => {
  // Parse user intent
  const intent = await parseUserIntent(userMessage, customers);

  // Execute action if needed
  let actionResult: { success: boolean; message: string; data?: any } | null = null;

  if (intent.intent !== 'general') {
    actionResult = await executeAction(
      intent.intent,
      intent.customerId,
      customers,
      intent.parameters
    );
  }

  // Build context for AI response
  const context = `
    ${intent.customerId ? `현재 선택된 고객: ${customers.find(c => c.id === intent.customerId)?.name || '없음'}` : ''}
    ${actionResult ? `실행 결과: ${actionResult.message}` : ''}
  `;

  try {
    const ai = getAI();

    // Build conversation context
    const historyContext = conversationHistory
      .slice(-5)
      .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
      .join('\n');

    const prompt = `
당신은 RINDA CRM의 AI 어시스턴트입니다. 사용자의 질문에 친절하고 도움이 되게 답변해주세요.

${historyContext ? `이전 대화:\n${historyContext}\n` : ''}

${context}

사용자: ${userMessage}

간결하고 도움이 되는 답변을 해주세요. 한국어로 응답하세요.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    });

    const assistantMessage: AIMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: response.text || '죄송합니다. 응답을 생성하지 못했습니다.',
      timestamp: Date.now(),
      metadata: {
        action: intent.intent,
        customerId: intent.customerId,
        result: actionResult
      }
    };

    return assistantMessage;
  } catch (error: any) {
    console.error('AI response generation failed:', error);

    // If action was executed, return its result
    if (actionResult) {
      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: actionResult.message,
        timestamp: Date.now(),
        metadata: {
          action: intent.intent,
          customerId: intent.customerId,
          result: actionResult
        }
      };
    }

    // Handle API key errors
    if (error?.message?.includes('API Key가 설정되지 않았습니다')) {
      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'API Key가 설정되지 않았습니다. 설정 메뉴에서 Gemini API Key를 입력해주세요.',
        timestamp: Date.now()
      };
    }

    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
      timestamp: Date.now(),
      metadata: {
        action: intent.intent,
        customerId: intent.customerId,
        result: actionResult
      }
    };
  }
};

// Process user message and return response
export const processUserMessage = async (
  userMessage: string,
  customers: Customer[],
  sessionId: string = 'default'
): Promise<{ userMessage: AIMessage; assistantMessage: AIMessage }> => {
  // Save user message
  const userMsg: AIMessage = {
    id: `msg_user_${Date.now()}`,
    role: 'user',
    content: userMessage,
    timestamp: Date.now()
  };

  saveMessage(userMsg, sessionId);

  // Get conversation history
  const history = getConversationHistory(sessionId);

  // Generate response
  const assistantMessage = await generateResponse(userMessage, customers, history, sessionId);

  // Save assistant message
  saveMessage(assistantMessage, sessionId);

  return { userMessage: userMsg, assistantMessage };
};

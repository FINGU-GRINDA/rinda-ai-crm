import { apiClient } from "../src/services/apiClient"
import { type AIMessage, type Customer, ImageSize } from "../types"
import {
  enrichCustomerData,
  generateProposalCoverImage,
  generateProposalStrategy,
} from "./geminiService"

// AI Assistant conversation storage
const AI_ASSISTANT_CONVERSATIONS_KEY = "rinda_ai_assistant_conversations"

// Get conversation history
export const getConversationHistory = (sessionId: string = "default"): AIMessage[] => {
  const stored = localStorage.getItem(`${AI_ASSISTANT_CONVERSATIONS_KEY}_${sessionId}`)
  return stored ? JSON.parse(stored) : []
}

// Save message to conversation
export const saveMessage = (message: AIMessage, sessionId: string = "default"): void => {
  const history = getConversationHistory(sessionId)
  history.push(message)

  // Keep last 100 messages
  const trimmed = history.slice(-100)
  localStorage.setItem(`${AI_ASSISTANT_CONVERSATIONS_KEY}_${sessionId}`, JSON.stringify(trimmed))
}

// Clear conversation history
export const clearConversationHistory = (sessionId: string = "default"): void => {
  localStorage.removeItem(`${AI_ASSISTANT_CONVERSATIONS_KEY}_${sessionId}`)
}

// Parse user intent from message - using backend API
export const parseUserIntent = async (
  message: string,
  customers: Customer[],
): Promise<{
  intent: "enrich" | "proposal" | "search" | "analyze" | "followup" | "general"
  customerId?: string
  customerName?: string
  parameters?: Record<string, any>
}> => {
  try {
    // Create customer names list for context
    const customerNames = customers.map((c) => ({ id: c.id, name: c.name }))

    const response = await apiClient.parseAssistantIntent(message, customerNames)
    const result = (response as any).data

    return {
      intent: result.intent || "general",
      customerId: result.customerId,
      customerName: result.customerName,
      parameters: result.parameters || {},
    }
  } catch (error) {
    console.error("Intent parsing failed:", error)
    return { intent: "general" }
  }
}

// Execute action based on intent
export const executeAction = async (
  intent: string,
  customerId: string | undefined,
  customers: Customer[],
  parameters?: Record<string, any>,
): Promise<{ success: boolean; message: string; data?: any }> => {
  if (!customerId && (intent === "enrich" || intent === "proposal")) {
    return {
      success: false,
      message: '고객을 먼저 지정해주세요. 예: "삼성전자 분석해줘"',
    }
  }

  const customer = customerId ? customers.find((c) => c.id === customerId) : null

  switch (intent) {
    case "enrich":
      if (!customer) {
        return { success: false, message: "고객을 찾을 수 없습니다." }
      }

      try {
        const enrichedData = await enrichCustomerData(customer.name, customer.website)
        return {
          success: true,
          message: `${customer.name}의 정보를 성공적으로 수집했습니다.`,
          data: { enrichedData, customerId: customer.id },
        }
      } catch (error: any) {
        return {
          success: false,
          message: `정보 수집 중 오류가 발생했습니다: ${error.message}`,
        }
      }

    case "proposal":
      if (!customer) {
        return { success: false, message: "고객을 찾을 수 없습니다." }
      }

      if (!customer.enrichedData) {
        return {
          success: false,
          message: "제안서를 생성하려면 먼저 고객 정보를 분석해주세요.",
        }
      }

      try {
        const proposalContent = await generateProposalStrategy(
          customer.name,
          customer.enrichedData,
          customer.notes || "",
        )

        const imageSize = (parameters?.imageSize as ImageSize) || ImageSize.Size_1K
        const proposalImage = await generateProposalCoverImage(
          customer.name,
          customer.industry,
          customer.enrichedData.summary,
          imageSize,
        )

        return {
          success: true,
          message: `${customer.name}에 대한 제안서를 생성했습니다.`,
          data: {
            proposal: {
              title: `${customer.name} 맞춤형 제안`,
              content: proposalContent,
              imageUrl: proposalImage,
            },
            customerId: customer.id,
          },
        }
      } catch (error: any) {
        return {
          success: false,
          message: `제안서 생성 중 오류가 발생했습니다: ${error.message}`,
        }
      }

    case "search": {
      const searchTerm = parameters?.query || ""
      const matchingCustomers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.website.toLowerCase().includes(searchTerm.toLowerCase()),
      )

      if (matchingCustomers.length === 0) {
        return {
          success: false,
          message: `"${searchTerm}"에 해당하는 고객을 찾을 수 없습니다.`,
        }
      }

      return {
        success: true,
        message: `${matchingCustomers.length}개의 고객을 찾았습니다.`,
        data: { customers: matchingCustomers },
      }
    }

    case "analyze": {
      const total = customers.length
      const byStatus = customers.reduce(
        (acc, c) => {
          acc[c.status] = (acc[c.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      return {
        success: true,
        message: `전체 ${total}개의 고객이 있습니다.`,
        data: {
          total,
          byStatus,
          enriched: customers.filter((c) => c.enrichedData).length,
          proposals: customers.reduce((sum, c) => sum + c.proposals.length, 0),
        },
      }
    }

    case "followup": {
      const followUpCustomers = customers.filter((c) => c.status !== "lost" && c.status !== "won")

      return {
        success: true,
        message: `Follow-up이 필요한 고객은 ${followUpCustomers.length}개입니다.`,
        data: { customers: followUpCustomers },
      }
    }

    default:
      return {
        success: false,
        message: "이해하지 못했습니다. 다시 말씀해주세요.",
      }
  }
}

// Generate AI assistant response - using backend API
export const generateResponse = async (
  userMessage: string,
  customers: Customer[],
  conversationHistory: AIMessage[] = [],
  _sessionId: string = "default",
): Promise<AIMessage> => {
  // Parse user intent
  const intent = await parseUserIntent(userMessage, customers)

  // Execute action if needed
  let actionResult: { success: boolean; message: string; data?: any } | null = null

  if (intent.intent !== "general") {
    actionResult = await executeAction(
      intent.intent,
      intent.customerId,
      customers,
      intent.parameters,
    )
  }

  // Build context for AI response
  const context = `
    ${intent.customerId ? `현재 선택된 고객: ${customers.find((c) => c.id === intent.customerId)?.name || "없음"}` : ""}
    ${actionResult ? `실행 결과: ${actionResult.message}` : ""}
  `

  try {
    // Call backend API for response generation
    const response = await apiClient.generateAssistantResponse(
      userMessage,
      context,
      conversationHistory.slice(-5),
    )
    const result = (response as any).data

    const assistantMessage: AIMessage = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: result.content || "죄송합니다. 응답을 생성하지 못했습니다.",
      timestamp: new Date().toISOString(),
      metadata: {
        action: intent.intent,
        customerId: intent.customerId,
        result: actionResult,
      },
    }

    return assistantMessage
  } catch (error: any) {
    console.error("AI response generation failed:", error)

    // If action was executed, return its result
    if (actionResult) {
      return {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: actionResult.message,
        timestamp: new Date().toISOString(),
        metadata: {
          action: intent.intent,
          customerId: intent.customerId,
          result: actionResult,
        },
      }
    }

    // Handle service unavailable errors
    if (error?.message?.includes("AI service not available")) {
      return {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content:
          "AI 서비스를 사용할 수 없습니다. 서버의 Gemini API 키가 설정되어 있는지 확인해주세요.",
        timestamp: new Date().toISOString(),
      }
    }

    return {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: "죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.",
      timestamp: new Date().toISOString(),
      metadata: {
        action: intent.intent,
        customerId: intent.customerId,
        result: actionResult,
      },
    }
  }
}

// Process user message and return response
export const processUserMessage = async (
  userMessage: string,
  customers: Customer[],
  sessionId: string = "default",
): Promise<{ userMessage: AIMessage; assistantMessage: AIMessage }> => {
  // Save user message
  const userMsg: AIMessage = {
    id: `msg_user_${Date.now()}`,
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  }

  saveMessage(userMsg, sessionId)

  // Get conversation history
  const history = getConversationHistory(sessionId)

  // Generate response
  const assistantMessage = await generateResponse(userMessage, customers, history, sessionId)

  // Save assistant message
  saveMessage(assistantMessage, sessionId)

  return { userMessage: userMsg, assistantMessage }
}

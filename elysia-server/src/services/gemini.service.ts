import { type GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai"
import { config } from "../config"
import { logger } from "../utils/logger"

class GeminiService {
  private client: GoogleGenerativeAI | null = null
  private model: GenerativeModel | null = null
  private initialized = false

  private initialize() {
    if (this.initialized) return

    if (config.GEMINI_API_KEY) {
      this.client = new GoogleGenerativeAI(config.GEMINI_API_KEY)
      this.model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" })
      logger.info("Gemini AI service initialized")
    } else {
      logger.warn("GEMINI_API_KEY not configured")
    }

    this.initialized = true
  }

  isAvailable(): boolean {
    this.initialize()
    return !!this.client
  }

  async generateContent(prompt: string): Promise<string | null> {
    this.initialize()

    if (!this.model) {
      logger.error("Gemini model not available")
      return null
    }

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      const errorMsg1 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg1 }, "Error generating content")
      return null
    }
  }

  async generateJSON<T>(prompt: string): Promise<T | null> {
    const jsonPrompt = `${prompt}\n\nRespond with valid JSON only, no markdown formatting.`

    const text = await this.generateContent(jsonPrompt)
    if (!text) return null

    try {
      // Clean JSON string (remove markdown code blocks if present)
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim()
      return JSON.parse(cleaned) as T
    } catch (error) {
      const errorMsg2 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg2 }, "Error parsing JSON response")
      return null
    }
  }

  async summarizeMeeting(transcription: string): Promise<{
    summary: string
    keyDiscussions: string[]
    actionItems: string[]
    customerNeeds: string[]
    budgetMentions: string | null
    timelineMentions: string | null
    nextSteps: string[]
  } | null> {
    const prompt = `다음 미팅 녹취록을 분석하여 요약해주세요:

"${transcription}"

다음 JSON 형식으로 응답해주세요:
{
  "summary": "미팅 전체 요약 (2-3문장)",
  "keyDiscussions": ["주요 논의 사항 1", "주요 논의 사항 2"],
  "actionItems": ["액션 아이템 1", "액션 아이템 2"],
  "customerNeeds": ["고객 니즈 1", "고객 니즈 2"],
  "budgetMentions": "예산 관련 언급 (없으면 null)",
  "timelineMentions": "타임라인 관련 언급 (없으면 null)",
  "nextSteps": ["다음 단계 1", "다음 단계 2"]
}`

    return this.generateJSON(prompt)
  }

  async parseCustomerInquiry(messageText: string): Promise<{
    isInquiry: boolean
    companyName: string | null
    contactPerson: string | null
    inquiryType: string
    summary: string
    urgency: "high" | "medium" | "low"
    industry: string | null
  }> {
    const prompt = `다음 Slack 메시지를 분석하여 고객 문의 정보를 추출해주세요.

메시지: "${messageText}"

다음 JSON 형식으로 응답해주세요:
{
  "isInquiry": true/false (고객 문의인지 여부),
  "companyName": "회사명 (있는 경우, 없으면 null)",
  "contactPerson": "담당자명 (있는 경우, 없으면 null)",
  "inquiryType": "문의/견적/지원/기타 중 하나",
  "summary": "문의 내용 요약 (50자 이내)",
  "urgency": "high/medium/low",
  "industry": "산업 분야 추정 (있는 경우, 없으면 null)"
}

일반 대화나 내부 커뮤니케이션은 isInquiry를 false로 설정하세요.`

    const result = await this.generateJSON<{
      isInquiry: boolean
      companyName: string | null
      contactPerson: string | null
      inquiryType: string
      summary: string
      urgency: "high" | "medium" | "low"
      industry: string | null
    }>(prompt)

    return (
      result || {
        isInquiry: false,
        companyName: null,
        contactPerson: null,
        inquiryType: "기타",
        summary: "",
        urgency: "medium",
        industry: null,
      }
    )
  }

  async enrichCompany(
    companyName: string,
    website?: string,
  ): Promise<{
    summary: string
    ceo: string | null
    foundedYear: string | null
    recentNews: string | null
    competitors: string[]
    salesOpportunity: string
  } | null> {
    const prompt = `다음 회사에 대한 정보를 수집해주세요:
회사명: ${companyName}
${website ? `웹사이트: ${website}` : ""}

다음 JSON 형식으로 응답해주세요:
{
  "summary": "회사 개요 (2-3문장)",
  "ceo": "CEO/대표 이름 (알 수 없으면 null)",
  "foundedYear": "설립 연도 (알 수 없으면 null)",
  "recentNews": "최근 뉴스 요약 (없으면 null)",
  "competitors": ["경쟁사 1", "경쟁사 2"],
  "salesOpportunity": "영업 기회 분석"
}`

    return this.generateJSON(prompt)
  }

  async generateProposal(
    customerName: string,
    customerNeeds: string[],
    industry?: string,
  ): Promise<{
    title: string
    content: string
  } | null> {
    const prompt = `다음 고객을 위한 제안서 초안을 작성해주세요:

고객명: ${customerName}
${industry ? `산업: ${industry}` : ""}
고객 니즈:
${customerNeeds.map((n, i) => `${i + 1}. ${n}`).join("\n")}

다음 JSON 형식으로 응답해주세요:
{
  "title": "제안서 제목",
  "content": "제안서 본문 (마크다운 형식)"
}`

    return this.generateJSON(prompt)
  }
}

export const geminiService = new GeminiService()

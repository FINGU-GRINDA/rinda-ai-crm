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

  async generateFollowUpStrategy(
    customer: { name: string; industry?: string; status: string; notes?: string },
    enrichedData?: { summary: string; salesOpportunity?: string; recentNews?: string[] },
    isLostDeal: boolean = false,
  ): Promise<{
    recommendedTiming: string
    approach: string
    messageTone: string
    keyPoints: string[]
    probability: "high" | "medium" | "low"
    reasoning: string
  } | null> {
    const context = `
고객사: ${customer.name}
산업: ${customer.industry || "미지정"}
상태: ${customer.status}
내부 메모: ${customer.notes || "없음"}
${
  enrichedData
    ? `
회사 요약: ${enrichedData.summary}
${isLostDeal ? "" : `세일즈 기회: ${enrichedData.salesOpportunity || "분석중"}`}
${enrichedData.recentNews ? `최근 뉴스: ${enrichedData.recentNews.join(", ")}` : ""}
`
    : ""
}`

    const prompt = `당신은 RINDA CRM의 세일즈 전략가입니다.
${isLostDeal ? `거래를 놓친 고객 "${customer.name}"에 대한 재접촉 전략을 분석해주세요.` : `잠재 고객 "${customer.name}"에 대한 초기 접촉 및 Follow Up 전략을 수립해주세요.`}

${context}

다음을 포함한 JSON 객체를 한국어로 반환해주세요:
{
  "recommendedTiming": "최적의 ${isLostDeal ? "재" : ""}접촉 시기 (예: ${isLostDeal ? '"30일 후", "다음 분기 초", "즉시"' : '"즉시", "1주일 후", "다음 달"'})",
  "approach": "접근 방법 (예: ${isLostDeal ? '"가치 중심 재제안", "경쟁사 대안 제시", "관계 회복"' : '"가치 제안 중심", "니즈 탐색", "케이스 스터디 공유"'})",
  "messageTone": "메시지 톤 (예: ${isLostDeal ? '"전문적이고 공감적", "솔직하고 직접적"' : '"친근하고 전문적", "간결하고 직접적"'})",
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "probability": "성공 가능성 ('high', 'medium', 'low')",
  "reasoning": "전략 선택 이유"
}`

    const result = await this.generateJSON<{
      recommendedTiming: string
      approach: string
      messageTone: string
      keyPoints: string[]
      probability: "high" | "medium" | "low"
      reasoning: string
    }>(prompt)

    return result
  }

  async generateFollowUpMessage(
    customer: { name: string; industry?: string; status?: string; lostReason?: string },
    strategy: { approach: string; messageTone: string; keyPoints: string[] },
    enrichedData?: { summary: string; salesOpportunity?: string },
    isLostDeal: boolean = false,
  ): Promise<{
    subject?: string
    content: string
    suggestedChannel: "email" | "call" | "linkedin" | "meeting"
  } | null> {
    const context = `
고객사: ${customer.name}
산업: ${customer.industry || "미지정"}
${isLostDeal ? `거래 실패 사유: ${customer.lostReason || "미상"}` : `상태: ${customer.status || "미지정"}`}
전략: ${strategy.approach}
톤: ${strategy.messageTone}
핵심 포인트: ${strategy.keyPoints.join(", ")}
${enrichedData ? `회사 요약: ${enrichedData.summary}` : ""}`

    const prompt = `당신은 RINDA CRM의 세일즈 커뮤니케이션 전문가입니다.
${isLostDeal ? "거래를 놓친" : "잠재"} 고객 "${customer.name}"에게 보낼 ${isLostDeal ? "재접촉" : "초기 접촉"} 메시지를 작성해주세요.

${context}

다음을 포함한 JSON 객체를 한국어로 반환해주세요:
{
  "subject": "이메일 제목 (이메일인 경우)",
  "content": "메시지 본문 (전문적이고 설득력 있게, 200-300자)",
  "suggestedChannel": "권장 채널 ('email', 'call', 'linkedin', 'meeting')"
}

전략의 접근 방법과 톤을 반영하여, 고객의 관심을 끌고 다음 단계로 이어질 수 있는 메시지를 작성해주세요.
${isLostDeal ? "과거 거래 실패를 언급하되, 긍정적이고 재기회를 제시하는 방향으로 작성해주세요." : ""}`

    const result = await this.generateJSON<{
      subject?: string
      content: string
      suggestedChannel: "email" | "call" | "linkedin" | "meeting"
    }>(prompt)

    return result
  }

  async calculateOptimalFollowUpTiming(
    customer: { name: string; industry?: string; status: string; notes?: string },
    daysSinceLastContact: number = 0,
    enrichedData?: { summary: string; salesOpportunity?: string },
  ): Promise<{
    days: number
    reason: string
    priority: "high" | "medium" | "low"
  } | null> {
    const context = `
고객사: ${customer.name}
산업: ${customer.industry || "미지정"}
상태: ${customer.status}
마지막 접촉 이후 일수: ${daysSinceLastContact}일
내부 메모: ${customer.notes || "없음"}
${enrichedData ? `세일즈 기회: ${enrichedData.salesOpportunity || "분석중"}` : ""}`

    const prompt = `당신은 RINDA CRM의 세일즈 타이밍 전문가입니다.
다음 고객에 대한 최적의 재접촉 시기를 분석해주세요.

${context}

다음 JSON 형식으로 응답해주세요:
{
  "days": 숫자 (권장 재접촉까지의 일수),
  "reason": "권장 이유 (30자 이내)",
  "priority": "우선순위 ('high', 'medium', 'low')"
}`

    const result = await this.generateJSON<{
      days: number
      reason: string
      priority: "high" | "medium" | "low"
    }>(prompt)

    return result
  }

  async determineFollowUpType(customer: {
    name: string
    status: string
    notes?: string
  }): Promise<"email" | "call" | "meeting" | "message" | null> {
    const prompt = `당신은 RINDA CRM의 커뮤니케이션 채널 전문가입니다.
다음 고객에게 적절한 접촉 채널을 결정해주세요.

고객: ${customer.name}
상태: ${customer.status}
노트: ${customer.notes || "없음"}

고객의 상태와 상황을 고려하여 'email', 'call', 'meeting', 'message' 중 가장 적절한 채널 하나만 영어로 반환해주세요.
예: "email"`

    const text = await this.generateContent(prompt)
    if (!text) return null

    const channel = text
      .toLowerCase()
      .trim()
      .match(/email|call|meeting|message/)?.[0] as
      | "email"
      | "call"
      | "meeting"
      | "message"
      | undefined

    return channel || "email"
  }

  async parseUserIntent(
    message: string,
    customers: Array<{ id: string; name: string }> = [],
  ): Promise<{
    intent: "enrich" | "proposal" | "search" | "analyze" | "followup" | "general"
    customerId?: string
    customerName?: string
    parameters?: Record<string, unknown>
  } | null> {
    const customerList = customers.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n")

    const prompt = `당신은 RINDA CRM의 AI 어시스턴트입니다.
사용자 메시지를 분석하여 의도(intent)를 파악해주세요.

사용자 메시지: "${message}"

이용 가능한 고객:
${customerList || "없음"}

다음 JSON 형식으로 응답해주세요:
{
  "intent": "intent는 다음 중 하나 ('enrich', 'proposal', 'search', 'analyze', 'followup', 'general')",
  "customerId": "해당 고객 ID (없으면 null)",
  "customerName": "해당 고객명 (없으면 null)",
  "parameters": {
    "키": "값"
  }
}

intent 가이드:
- 'enrich': 고객 정보 조회/분석 요청
- 'proposal': 제안서 생성 요청
- 'search': 고객 검색 요청
- 'analyze': 데이터 분석 요청
- 'followup': 후속 조치 관련 요청
- 'general': 일반 대화`

    const result = await this.generateJSON<{
      intent: "enrich" | "proposal" | "search" | "analyze" | "followup" | "general"
      customerId?: string
      customerName?: string
      parameters?: Record<string, unknown>
    }>(prompt)

    return result || { intent: "general" }
  }

  async generateAssistantResponse(
    userMessage: string,
    context: string = "",
    conversationHistory: Array<{ role: string; content: string }> = [],
  ): Promise<string | null> {
    const historyText = conversationHistory
      .slice(-5)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n")

    const prompt = `당신은 RINDA CRM의 친절한 AI 어시스턴트입니다.
고객 관계 관리(CRM)와 영업 활동에 대한 조언을 제공합니다.

${context ? `컨텍스트:\n${context}\n` : ""}
${historyText ? `대화 히스토리:\n${historyText}\n` : ""}

사용자 메시지: "${userMessage}"

사용자 메시지에 대해 친절하고 전문적인 응답을 한국어로 제공해주세요.
CRM 관련 조언이나 다음 단계를 제시해주세요.`

    return this.generateContent(prompt)
  }

  async detectRiskSignals(
    customer: { name: string; industry?: string; status: string; notes?: string },
    daysSinceLastContact: number = 0,
    enrichedData?: { recentNews?: string[] },
  ): Promise<{
    hasRisk: boolean
    riskReason?: string
    priority?: "high" | "medium"
  } | null> {
    const context = `
고객사: ${customer.name}
산업: ${customer.industry || "미지정"}
상태: ${customer.status}
마지막 접촉 이후 일수: ${daysSinceLastContact}일
내부 메모: ${customer.notes || "없음"}
${enrichedData?.recentNews ? `최근 뉴스: ${enrichedData.recentNews.join(", ")}` : ""}`

    const prompt = `당신은 RINDA CRM의 위험 신호 감지 전문가입니다.
고객 관계에 잠재적인 위험 신호가 있는지 분석해주세요.

${context}

위험 신호 고려사항:
- 장시간 연락 없음 (30일 이상)
- 상태 변화 (예: 활성 → 미활성)
- 부정적인 뉴스 언급
- 경쟁사 언급

다음 JSON 형식으로 응답해주세요:
{
  "hasRisk": 위험 신호 여부 (true/false),
  "riskReason": "위험 신호 설명 (있는 경우)",
  "priority": "우선순위 ('high', 'medium', 없으면 null)"
}`

    const result = await this.generateJSON<{
      hasRisk: boolean
      riskReason?: string
      priority?: "high" | "medium"
    }>(prompt)

    return result
  }

  async parseCSInquiry(messageText: string): Promise<{
    companyName: string | null
    contactName: string | null
    contactTitle: string | null
    contactPhone: string | null
    contactEmail: string | null
    inquiryDetails: string | null
    leadSource: string | null
    landingPageUrl: string | null
  }> {
    const prompt = `다음 Slack 메시지에서 고객 문의 정보를 추출해주세요.
메시지는 영어 또는 한국어로 작성되었으며, 구조화된 형식 또는 자유 형식일 수 있습니다.

메시지:
"""
${messageText}
"""

다음 필드를 찾아서 JSON으로 추출해주세요:
- Company Name / 회사명
- Contact Person / 담당자명
- Title / 직함 (담당자명과 같은 줄에 있을 수 있음, 예: "홍길동 / 팀장")
- Contact Number / 연락처 / 전화번호
- Email / 이메일
- Inquiry Details / 문의 내용 / 문의사항
- Lead Source / 리드 소스 / 유입 경로
- First Landing Page / 최초 랜딩 페이지 / Landing Page URL

다음 JSON 형식으로 응답해주세요:
{
  "companyName": "회사명 (없으면 null)",
  "contactName": "담당자명 (없으면 null)",
  "contactTitle": "직함 (없으면 null)",
  "contactPhone": "전화번호 (없으면 null)",
  "contactEmail": "이메일 (없으면 null)",
  "inquiryDetails": "문의 내용 전체 (없으면 null)",
  "leadSource": "유입 경로 (없으면 null)",
  "landingPageUrl": "랜딩 페이지 URL (없으면 null)"
}

참고:
- 담당자명에 슬래시(/)가 있으면 앞이 이름, 뒤가 직함입니다
- 전화번호는 +81, +82 등 국제 형식일 수 있습니다
- URL은 http:// 또는 https://로 시작합니다
- 찾을 수 없는 필드는 null로 설정하세요`

    const result = await this.generateJSON<{
      companyName: string | null
      contactName: string | null
      contactTitle: string | null
      contactPhone: string | null
      contactEmail: string | null
      inquiryDetails: string | null
      leadSource: string | null
      landingPageUrl: string | null
    }>(prompt)

    return (
      result || {
        companyName: null,
        contactName: null,
        contactTitle: null,
        contactPhone: null,
        contactEmail: null,
        inquiryDetails: null,
        leadSource: null,
        landingPageUrl: null,
      }
    )
  }

  async parseMeetingNote(messageText: string): Promise<{
    leadCompanyName: string | null
    decisionMakerName: string | null
    meetingNote: string | null
    salesProposal: string | null
  }> {
    const prompt = `다음 Slack 메시지에서 미팅 노트 정보를 추출해주세요.
메시지는 한국어로 작성되었으며, 특정 형식을 따릅니다.

메시지:
"""
${messageText}
"""

메시지 구조:
- 첫 번째 줄: 리드 회사명 (예: "르베떼")
- 두 번째 줄: 의사결정자 이름 (예: "백지혜 대표")
- (Meeting Note) 섹션: 미팅 내용
- (Sales Proposal & Action Plan) 섹션: 제안 및 액션 플랜

다음 JSON 형식으로 응답해주세요:
{
  "leadCompanyName": "리드 회사명 (첫 번째 줄에서 추출)",
  "decisionMakerName": "의사결정자 이름 (두 번째 줄에서 '대표', '팀장' 등 직함 제거)",
  "meetingNote": "(Meeting Note) 섹션 전체 내용",
  "salesProposal": "(Sales Proposal & Action Plan) 섹션 전체 내용"
}

참고:
- 의사결정자 이름에서 '대표', '팀장', 'CEO' 등 직함은 제거하고 이름만 추출
- 섹션이 명확하지 않으면 전체 내용을 meetingNote로 설정
- 찾을 수 없는 필드는 null로 설정`

    const result = await this.generateJSON<{
      leadCompanyName: string | null
      decisionMakerName: string | null
      meetingNote: string | null
      salesProposal: string | null
    }>(prompt)

    return (
      result || {
        leadCompanyName: null,
        decisionMakerName: null,
        meetingNote: null,
        salesProposal: null,
      }
    )
  }

  async classifySalesMessage(messageText: string): Promise<{
    messageType: "new_customer" | "existing_customer" | "other"
    confidence: "high" | "medium" | "low"
    companyName: string | null
    reasoning: string
  }> {
    const prompt = `다음 Slack 메시지를 분석하여 새로운 고객에 대한 것인지, 기존 고객에 대한 것인지 판단해주세요.

메시지:
"""
${messageText}
"""

판단 기준:
- "새로운 고객" (new_customer): 신규 리드, 신규 문의, 처음 연락한 회사
- "기존 고객" (existing_customer): 이미 알고 있는 고객의 상태 변경, 진행 상황 업데이트, 미팅 결과 등
- "기타" (other): 일반 대화, 내부 커뮤니케이션

다음 JSON 형식으로 응답해주세요:
{
  "messageType": "new_customer" 또는 "existing_customer" 또는 "other",
  "confidence": "high" 또는 "medium" 또는 "low",
  "companyName": "언급된 회사명 (없으면 null)",
  "reasoning": "판단 근거 (한 문장)"
}`

    const result = await this.generateJSON<{
      messageType: "new_customer" | "existing_customer" | "other"
      confidence: "high" | "medium" | "low"
      companyName: string | null
      reasoning: string
    }>(prompt)

    return (
      result || {
        messageType: "other",
        confidence: "low",
        companyName: null,
        reasoning: "분류 실패",
      }
    )
  }

  async parseSalesUpdate(
    messageText: string,
    customerContext?: string,
  ): Promise<{
    updateType: "status_change" | "add_note" | "create_followup" | "update_contact"
    customerId: string | null
    customerName: string | null
    statusChange?: {
      newStatus: "prospect" | "new" | "contact" | "negotiation" | "won" | "lost"
      reason?: string
    }
    note?: string
    followUp?: {
      type: "email" | "call" | "meeting" | "message"
      content: string
      scheduledDays: number
    }
    contactUpdate?: {
      name?: string
      title?: string
      email?: string
      phone?: string
    }
  }> {
    const contextInfo = customerContext ? `\n\n관련 고객 정보:\n${customerContext}` : ""

    const prompt = `다음 Slack 메시지에서 고객 업데이트 정보를 추출해주세요.${contextInfo}

메시지:
"""
${messageText}
"""

업데이트 유형을 판단하고 해당 정보를 추출해주세요:

1. status_change: 고객 상태 변경 (예: "계약 성사", "미팅 예정", "협상 중", "거절됨")
   - 상태: prospect(잠재) / new(신규) / contact(연락중) / negotiation(협상) / won(성사) / lost(실패)

2. add_note: 메모 추가 (예: "미팅 결과", "통화 내용", "진행 상황")

3. create_followup: 후속 조치 생성 (예: "다음 주에 연락", "제안서 보내기")

4. update_contact: 연락처 정보 업데이트 (예: "담당자 변경", "새 이메일")

다음 JSON 형식으로 응답해주세요:
{
  "updateType": "status_change" | "add_note" | "create_followup" | "update_contact",
  "customerId": null,
  "customerName": "회사명 (없으면 null)",
  "statusChange": {
    "newStatus": "상태 (status_change인 경우)",
    "reason": "변경 이유 (선택)"
  },
  "note": "메모 내용 (add_note인 경우)",
  "followUp": {
    "type": "email" | "call" | "meeting" | "message",
    "content": "후속 조치 내용",
    "scheduledDays": 7 (며칠 후인지 숫자)
  },
  "contactUpdate": {
    "name": "담당자명",
    "title": "직함",
    "email": "이메일",
    "phone": "전화번호"
  }
}

참고: 해당하지 않는 필드는 undefined로 설정`

    const result = await this.generateJSON<{
      updateType: "status_change" | "add_note" | "create_followup" | "update_contact"
      customerId: string | null
      customerName: string | null
      statusChange?: {
        newStatus: "prospect" | "new" | "contact" | "negotiation" | "won" | "lost"
        reason?: string
      }
      note?: string
      followUp?: {
        type: "email" | "call" | "meeting" | "message"
        content: string
        scheduledDays: number
      }
      contactUpdate?: {
        name?: string
        title?: string
        email?: string
        phone?: string
      }
    }>(prompt)

    return (
      result || {
        updateType: "add_note",
        customerId: null,
        customerName: null,
        note: messageText,
      }
    )
  }

  /**
   * Analyze an image using Gemini Vision API
   * Used as fallback when Tesseract OCR confidence is low
   */
  async analyzeImage(buffer: Buffer, mimetype: string, fileName: string): Promise<string> {
    this.initialize()

    if (!this.model) {
      throw new Error("Gemini model not available")
    }

    try {
      // Convert buffer to base64
      const base64Data = buffer.toString("base64")

      // Create the image part for Gemini multimodal
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimetype,
        },
      }

      const prompt = `이 이미지를 분석해주세요. 이미지에 있는 모든 텍스트, 표, 차트, 그리고 중요한 시각적 정보를 추출해주세요. 비즈니스 문서인 경우 핵심 내용을 요약해주세요.

이미지 파일명: ${fileName}

다음 형식으로 응답해주세요:
[이미지 유형]: (예: 명함, 계약서, 인포그래픽, 사진 등)
[추출된 텍스트]: (이미지에서 읽을 수 있는 모든 텍스트)
[핵심 정보]: (중요한 정보 요약)`

      const result = await this.model.generateContent([prompt, imagePart])
      const response = await result.response
      return response.text()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg, fileName }, "Image analysis with Gemini failed")
      throw new Error(`Image analysis failed: ${errorMsg}`)
    }
  }
}

export const geminiService = new GeminiService()

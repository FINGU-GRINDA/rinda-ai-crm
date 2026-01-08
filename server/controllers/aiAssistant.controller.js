import { geminiClient } from '../services/geminiClient.js';
import { logger } from '../utils/logger.js';
import { Type } from '@google/genai';
import { contactRepository } from '../database/repositories/contactRepository.js';
import { meetingRepository } from '../database/repositories/meetingRepository.js';
import { customerRepository } from '../database/repositories/customerRepository.js';

/**
 * AI Assistant Controller
 * Handles all AI-related endpoints including intent parsing, enrichment, and proposal generation
 */

export const aiAssistantController = {
  /**
   * Parse user intent from natural language message
   * POST /api/ai/parse-intent
   */
  async parseIntent(req, res, next) {
    try {
      const { message, customers } = req.body;

      // Validation
      if (!message || !customers) {
        return res.status(400).json({
          error: '필수 필드가 누락되었습니다.',
          code: 'MISSING_FIELDS'
        });
      }

      const modelId = 'gemini-1.5-flash';
      const customerList = customers.map(c => `${c.name} (ID: ${c.id})`).join(', ');

      const prompt = `
        사용자의 메시지를 분석하여 의도를 파악해주세요.

        사용자 메시지: "${message}"

        가능한 고객사 목록:
        ${customerList || '없음'}

        의도 유형:
        - enrich: 고객 정보 분석/수집 요청
        - proposal: 제안서 생성 요청
        - search: 고객 검색
        - analyze: 분석 요청
        - followup: Follow-up 관련
        - general: 일반 대화

        JSON 형식으로 반환:
        {
          "intent": "의도 유형",
          "customerId": "고객 ID (고객이 언급된 경우)",
          "customerName": "고객 이름",
          "parameters": {}
        }
      `;

      const response = await geminiClient.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const result = JSON.parse(response.text || '{}');

      // Find customer by name if provided
      if (result.customerName && !result.customerId) {
        const customer = customers.find(c =>
          c.name.toLowerCase().includes(result.customerName.toLowerCase()) ||
          result.customerName.toLowerCase().includes(c.name.toLowerCase())
        );
        if (customer) {
          result.customerId = customer.id;
        }
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Enrich customer data using AI and Google Search
   * POST /api/ai/enrich
   */
  async enrichCustomer(req, res, next) {
    try {
      const { companyName, website } = req.body;

      if (!companyName) {
        return res.status(400).json({
          error: '회사명은 필수 입력 항목입니다.',
          code: 'MISSING_COMPANY_NAME'
        });
      }

      const modelId = 'gemini-1.5-flash';

      const prompt = `
        기업 "${companyName}" (${website})을 분석해주세요.
        다음 정보를 한국어로 제공해주세요:
        1. 포괄적인 비즈니스 요약.
        2. 현재 CEO 및 설립 연도.
        3. 웹에서 검색한 이 회사의 최근 뉴스 헤드라인 또는 이벤트 3가지.
        4. 주요 경쟁사 3곳.
        5. "세일즈 기회 및 전략": 이 회사의 상황을 바탕으로 B2B 솔루션을 제안할 수 있는 구체적인 기회와 접근 전략을 분석해서 작성해주세요.
      `;

      const response = await geminiClient.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              ceo: { type: Type.STRING },
              foundedYear: { type: Type.STRING },
              recentNews: { type: Type.ARRAY, items: { type: Type.STRING } },
              competitors: { type: Type.ARRAY, items: { type: Type.STRING } },
              salesOpportunity: { type: Type.STRING }
            },
            required: ['summary', 'ceo', 'foundedYear', 'recentNews', 'competitors', 'salesOpportunity']
          }
        }
      });

      const enrichedData = JSON.parse(response.text || '{}');

      // Extract grounding sources
      const sources = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk) => {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push({ title: chunk.web.title, uri: chunk.web.uri });
          }
        });
      }

      res.json({
        ...enrichedData,
        sources: sources.slice(0, 5) // Top 5 sources
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate proposal strategy and content
   * POST /api/ai/generate-proposal
   */
  async generateProposal(req, res, next) {
    try {
      const { customerName, enrichedData, userNotes } = req.body;

      if (!customerName || !enrichedData) {
        return res.status(400).json({
          error: '필수 필드가 누락되었습니다.',
          code: 'MISSING_FIELDS'
        });
      }

      // Generate proposal strategy
      const strategyModelId = 'gemini-1.5-pro';

      const context = `
        고객사: ${customerName}
        요약: ${enrichedData.summary}
        최신 뉴스: ${enrichedData.recentNews?.join(', ')}
        경쟁사: ${enrichedData.competitors?.join(', ')}
        AI 세일즈 분석: ${enrichedData.salesOpportunity}
        내부 메모: ${userNotes || ''}
      `;

      const strategyPrompt = `
        당신은 RINDA CRM의 수석 세일즈 전략가입니다.
        ${customerName}를 위한 고가치의 맞춤형 제안서 초안을 작성해주세요.

        ${context}

        위 컨텍스트 정보를 바탕으로 다음 구조의 Markdown 문서를 한국어로 작성하세요:

        # ${customerName} 맞춤형 제안 전략

        ## 1. 제안 배경 (Executive Summary)
        - 고객사의 현재 상황과 최근 이슈를 언급하며 공감대 형성.

        ## 2. 고객 니즈 및 분석 (Analysis)
        - 경쟁 상황 및 현재 직면한 과제 분석.
        - AI가 분석한 세일즈 기회 요약.

        ## 3. 솔루션 제안 (Strategic Solution)
        - 우리가 제안하는 핵심 가치와 솔루션.
        - 구체적인 해결 방안 3가지 (불렛 포인트).

        ## 4. 기대 효과 및 로드맵 (Impact & Roadmap)
        - 도입 시 예상되는 정량적/정성적 효과.
        - 향후 진행 계획.

        톤앤매너: 전문적이고, 신뢰감을 주며, 설득력 있게 작성하세요.
      `;

      const strategyResponse = await geminiClient.generateContent({
        model: strategyModelId,
        contents: strategyPrompt
      });

      const proposalContent = strategyResponse.text || '제안서 전략 생성에 실패했습니다.';

      // Image generation is skipped for now as it requires Imagen model
      // which has different API requirements
      let coverImageUrl = null;

      res.json({
        title: `${customerName} 맞춤형 제안`,
        content: proposalContent,
        imageUrl: coverImageUrl
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate AI assistant response
   * POST /api/ai/generate-response
   */
  async generateResponse(req, res, next) {
    try {
      const { message, context, conversationHistory } = req.body;

      if (!message) {
        return res.status(400).json({
          error: '메시지가 필요합니다.',
          code: 'MISSING_MESSAGE'
        });
      }

      const modelId = 'gemini-1.5-flash';

      const historyContext = conversationHistory && conversationHistory.length > 0
        ? `대화 히스토리:\n${conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}`
        : '';

      const prompt = `
        당신은 RINDA CRM의 AI 어시스턴트입니다.
        사용자가 CRM 시스템을 자연어로 제어할 수 있도록 도와주세요.

        ${context || ''}
        ${historyContext}

        사용자 메시지: "${message}"

        한국어로 응답해주세요. 간결하고 명확하게 작성해주세요.
      `;

      const response = await geminiClient.generateContent({
        model: modelId,
        contents: prompt
      });

      res.json({
        content: response.text || '응답을 생성하지 못했습니다.'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Scan business card image and extract contact information
   * POST /api/ai/scan-business-card
   */
  async scanBusinessCard(req, res, next) {
    try {
      const { image, customerId, createCustomer } = req.body;

      if (!image) {
        return res.status(400).json({
          error: '이미지가 필요합니다.',
          code: 'MISSING_IMAGE'
        });
      }

      const modelId = 'gemini-1.5-flash';

      const prompt = `
        이 명함 이미지에서 다음 정보를 추출해주세요:
        1. companyName: 회사명
        2. website: 웹사이트 URL
        3. contactName: 담당자 이름
        4. title: 직함/직위
        5. email: 이메일 주소
        6. phone: 전화번호

        JSON 형식으로 반환해주세요.
        정보가 없는 필드는 null로 표시하세요.
        담당자 이름(contactName)은 반드시 추출해야 합니다.
      `;

      // Extract base64 data (remove data URL prefix if present)
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

      const response = await geminiClient.generateContent({
        model: modelId,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              companyName: { type: Type.STRING, nullable: true },
              website: { type: Type.STRING, nullable: true },
              contactName: { type: Type.STRING },
              title: { type: Type.STRING, nullable: true },
              email: { type: Type.STRING, nullable: true },
              phone: { type: Type.STRING, nullable: true }
            },
            required: ['contactName']
          }
        }
      });

      const cardData = JSON.parse(response.text || '{}');
      logger.info('Business card scanned:', { contactName: cardData.contactName, companyName: cardData.companyName });

      let resultCustomerId = customerId;
      let contactId = null;

      // Create new customer if requested and company name is available
      if (createCustomer && cardData.companyName && !customerId) {
        const newCustomer = customerRepository.create({
          name: cardData.companyName,
          website: cardData.website || '',
          industry: '미분류',
          notes: '',
          status: 'new'
        });
        resultCustomerId = newCustomer.id;
        logger.info('New customer created from business card:', { customerId: resultCustomerId, name: cardData.companyName });
      }

      // Create contact if we have a customer ID
      if (resultCustomerId && cardData.contactName) {
        const newContact = contactRepository.create({
          customerId: resultCustomerId,
          name: cardData.contactName,
          title: cardData.title,
          email: cardData.email,
          phone: cardData.phone,
          source: 'business_card',
          isPrimary: true
        });
        contactId = newContact.id;
        logger.info('Contact created from business card:', { contactId, name: cardData.contactName });
      }

      res.json({
        success: true,
        data: cardData,
        customerId: resultCustomerId,
        contactId
      });
    } catch (error) {
      logger.error('Business card scan failed:', { error: error.message });
      next(error);
    }
  },

  /**
   * Summarize meeting audio or transcription
   * POST /api/ai/summarize-meeting
   */
  async summarizeMeeting(req, res, next) {
    try {
      const { audioData, transcription, customerId, title, meetingDate } = req.body;

      if (!customerId || !title) {
        return res.status(400).json({
          error: '고객 ID와 미팅 제목은 필수입니다.',
          code: 'MISSING_FIELDS'
        });
      }

      if (!audioData && !transcription) {
        return res.status(400).json({
          error: '오디오 데이터 또는 녹취록이 필요합니다.',
          code: 'MISSING_AUDIO_OR_TRANSCRIPTION'
        });
      }

      // Use gemini-1.5-flash for audio processing (supports audio input)
      const modelId = 'gemini-1.5-flash';

      const prompt = `
        다음 세일즈 미팅 내용을 분석하여 영업팀을 위한 요약을 작성해주세요.

        ${transcription ? `[미팅 녹취록]\n${transcription}` : '[오디오 내용을 분석해주세요]'}

        다음 항목들을 반드시 포함해주세요:
        1. summary: 미팅 전체 요약 (2-3문장)
        2. keyDiscussions: 핵심 논의사항 (배열, 최대 5개)
        3. actionItems: 액션 아이템 - 누가 무엇을 언제까지 해야 하는지 구체적으로 (배열, 최대 5개)
        4. customerNeeds: 고객이 언급한 니즈/요구사항/불만사항 (배열, 최대 5개)
        5. budgetMentions: 예산 관련 언급 (문자열, 없으면 null)
        6. timelineMentions: 일정/타임라인 관련 언급 (문자열, 없으면 null)
        7. nextSteps: 권장하는 다음 단계 (배열, 최대 3개)

        반드시 유효한 JSON 형식으로만 반환해주세요. 한국어로 작성해주세요.
        예시:
        {
          "summary": "미팅 요약...",
          "keyDiscussions": ["논의1", "논의2"],
          "actionItems": ["액션1", "액션2"],
          "customerNeeds": ["니즈1", "니즈2"],
          "budgetMentions": null,
          "timelineMentions": null,
          "nextSteps": ["다음단계1", "다음단계2"]
        }
      `;

      let contents;

      if (audioData && !transcription) {
        // Use Gemini's native audio input
        // Extract base64 and detect mime type
        const mimeMatch = audioData.match(/^data:(audio\/[^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';
        const base64Audio = audioData.replace(/^data:audio\/[^;]+;base64,/, '');

        contents = [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Audio
                }
              }
            ]
          }
        ];
      } else {
        contents = prompt;
      }

      const response = await geminiClient.generateContent({
        model: modelId,
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              keyDiscussions: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
              customerNeeds: { type: Type.ARRAY, items: { type: Type.STRING } },
              budgetMentions: { type: Type.STRING, nullable: true },
              timelineMentions: { type: Type.STRING, nullable: true },
              nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['summary', 'keyDiscussions', 'actionItems', 'customerNeeds', 'nextSteps']
          }
        }
      });

      const summaryData = JSON.parse(response.text || '{}');
      logger.info('Meeting summarized:', { customerId, title });

      // Save to database
      const meetingSummary = meetingRepository.create({
        customerId,
        title,
        meetingDate: meetingDate || Date.now(),
        summary: summaryData.summary,
        keyDiscussions: summaryData.keyDiscussions,
        actionItems: summaryData.actionItems,
        customerNeeds: summaryData.customerNeeds,
        budgetMentions: summaryData.budgetMentions,
        timelineMentions: summaryData.timelineMentions,
        nextSteps: summaryData.nextSteps,
        transcription: transcription || null
      });

      res.json({
        success: true,
        meetingSummaryId: meetingSummary.id,
        summary: meetingSummary
      });
    } catch (error) {
      logger.error('Meeting summarization failed:', { error: error.message, stack: error.stack });
      next(error);
    }
  }
};

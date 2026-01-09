import { EnrichedData, ImageSize } from "../types";
import GeminiAPIManager from "./geminiApiManager";

// Get AI instance from manager
const getAI = () => GeminiAPIManager.getInstance().getAiInstance();

// 1. Customer Enrichment using Gemini API directly
export const enrichCustomerData = async (companyName: string, website: string): Promise<EnrichedData> => {
  try {
    const ai = getAI();

    const prompt = `
당신은 B2B 영업 전문가입니다. 다음 회사에 대한 정보를 조사하고 분석해주세요.

회사명: ${companyName}
웹사이트: ${website}

다음 JSON 형식으로 응답해주세요 (반드시 유효한 JSON만 출력):
{
  "summary": "회사에 대한 간단한 설명 (2-3문장)",
  "ceo": "CEO 이름 (모르면 빈 문자열)",
  "foundedYear": "설립연도 (모르면 빈 문자열)",
  "recentNews": ["최근 뉴스 또는 동향 1", "최근 뉴스 또는 동향 2", "최근 뉴스 또는 동향 3"],
  "competitors": ["경쟁사 1", "경쟁사 2"],
  "salesOpportunity": "이 회사에 대한 영업 기회 분석 (어떤 니즈가 있을지, 어떻게 접근하면 좋을지)",
  "sources": []
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    });

    const text = response.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
    }

    const data = JSON.parse(jsonMatch[0]);

    return {
      summary: data.summary || '',
      ceo: data.ceo || '',
      foundedYear: data.foundedYear || '',
      recentNews: data.recentNews || [],
      competitors: data.competitors || [],
      salesOpportunity: data.salesOpportunity || '',
      sources: data.sources || []
    };
  } catch (error: any) {
    console.error("Enrichment failed:", error);

    // Provide more specific error messages
    if (error?.message?.includes('API Key가 설정되지 않았습니다')) {
      throw new Error('API Key가 설정되지 않았습니다. 설정 메뉴에서 Gemini API Key를 입력해주세요.');
    } else if (error?.message?.includes('API key') || error?.message?.includes('INVALID_ARGUMENT')) {
      throw new Error('API Key가 유효하지 않습니다. 설정에서 올바른 API Key를 입력해주세요.');
    } else if (error?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }

    throw new Error(error.message || '고객 정보 수집에 실패했습니다.');
  }
};

// 2. Proposal Strategy using Gemini API directly
export const generateProposalStrategy = async (customerName: string, enrichedData: EnrichedData, userNotes: string): Promise<string> => {
  try {
    const ai = getAI();

    const prompt = `
당신은 B2B 영업 제안서 작성 전문가입니다. 다음 고객 정보를 바탕으로 맞춤형 제안서를 작성해주세요.

## 고객 정보
- 회사명: ${customerName}
- 회사 소개: ${enrichedData.summary}
- CEO: ${enrichedData.ceo || '정보 없음'}
- 설립연도: ${enrichedData.foundedYear || '정보 없음'}
- 최근 동향: ${enrichedData.recentNews?.join(', ') || '정보 없음'}
- 영업 기회: ${enrichedData.salesOpportunity || '정보 없음'}

## 추가 메모
${userNotes || '없음'}

## 작성 지침
1. 고객의 니즈와 상황에 맞춘 제안서를 작성하세요
2. 구체적인 가치 제안을 포함하세요
3. 전문적이고 설득력 있는 톤을 유지하세요
4. Markdown 형식으로 작성하세요

제안서를 작성해주세요:
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        maxOutputTokens: 4096,
      }
    });

    return response.text || "제안서 생성에 실패했습니다.";
  } catch (error: any) {
    console.error("Proposal strategy generation failed:", error);

    if (error?.message?.includes('API Key가 설정되지 않았습니다')) {
      throw new Error('API Key가 설정되지 않았습니다. 설정 메뉴에서 Gemini API Key를 입력해주세요.');
    }

    throw new Error(error.message || '제안서 생성에 실패했습니다.');
  }
};

// 3. Proposal Cover Image - returns placeholder since image generation requires different API
export const generateProposalCoverImage = async (
  customerName: string,
  industry: string,
  summary: string,
  imageSize: ImageSize
): Promise<string> => {
  // Note: Gemini API doesn't support image generation directly
  // Return a placeholder or use a different service
  console.log(`Image generation requested for ${customerName} (${industry}) at ${imageSize}`);

  // Return a placeholder gradient image URL based on industry
  const colors = {
    'SaaS': '667eea,764ba2',
    'IT': '11998e,38ef7d',
    'Healthcare': 'ee0979,ff6a00',
    'Finance': '2193b0,6dd5ed',
    'Manufacturing': '834d9b,d04ed6',
    'default': '4facfe,00f2fe'
  };

  const colorPair = colors[industry as keyof typeof colors] || colors.default;
  const size = imageSize === '1K' ? '1024' : imageSize === '2K' ? '2048' : '512';

  // Use placeholder.com or similar service
  return `https://via.placeholder.com/${size}x${size}/${colorPair.split(',')[0]}/${colorPair.split(',')[1]}?text=${encodeURIComponent(customerName)}`;
};

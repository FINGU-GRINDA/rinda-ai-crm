import { EnrichedData, ImageSize } from "../types";
import { apiClient } from "../src/services/apiClient";

// 1. Customer Enrichment using backend API
export const enrichCustomerData = async (companyName: string, website: string): Promise<EnrichedData> => {
  try {
    const prompt = `
다음 회사에 대한 정보를 조사하고 분석해주세요.

회사명: ${companyName}
웹사이트: ${website}

다음 JSON 형식으로 응답해주세요 (반드시 유효한 JSON만 출력):
{
  "summary": "회사에 대한 간단한 설명 (2-3문장)",
  "ceo": "CEO 이름 (모르면 빈 문자열)",
  "foundedYear": "설립연도 (모르면 빈 문자열)",
  "recentNews": ["최근 뉴스 또는 동향 1", "최근 뉴스 또는 동향 2", "최근 뉴스 또는 동향 3"],
  "competitors": ["경쟁사 1", "경쟁사 2"],
  "salesOpportunity": "이 회사에 대한 영업 기회 분석",
  "sources": []
}
`;

    const response = await apiClient.request('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });

    const result = (response as any).data || {};
    const text = result.content || '';

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
    if (error?.message?.includes('AI service not available')) {
      throw new Error('AI 서비스를 사용할 수 없습니다. 서버의 Gemini API 키가 설정되어 있는지 확인해주세요.');
    }

    throw new Error(error.message || '고객 정보 수집에 실패했습니다.');
  }
};

// 2. Proposal Strategy using backend API
export const generateProposalStrategy = async (customerName: string, enrichedData: EnrichedData, userNotes: string): Promise<string> => {
  try {
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

제안서를 Markdown 형식으로 작성해주세요:
`;

    const response = await apiClient.request('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });

    const result = (response as any).data || {};
    return result.content || "제안서 생성에 실패했습니다.";
  } catch (error: any) {
    console.error("Proposal strategy generation failed:", error);

    if (error?.message?.includes('AI service not available')) {
      throw new Error('AI 서비스를 사용할 수 없습니다. 서버의 Gemini API 키가 설정되어 있는지 확인해주세요.');
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

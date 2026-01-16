import { GoogleGenAI } from "@google/genai";

/**
 * GeminiAPIManager - Singleton Pattern
 *
 * Gemini API 인스턴스를 중앙에서 관리하여 중복 생성을 방지하고
 * 일관된 API Key 관리 및 에러 처리를 제공합니다.
 */
class GeminiAPIManager {
  private static instance: GeminiAPIManager;
  private apiKey: string | null = null;
  private aiInstance: GoogleGenAI | null = null;
  private isValidated: boolean = false;

  private constructor() {
    // 환경변수 > localStorage 순서로 API Key 로드
    this.loadApiKey();
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): GeminiAPIManager {
    if (!GeminiAPIManager.instance) {
      GeminiAPIManager.instance = new GeminiAPIManager();
    }
    return GeminiAPIManager.instance;
  }

  /**
   * API Key 로드 (사용자 제공 키 우선, 환경변수 백업)
   * 사용자가 직접 입력한 키가 환경변수보다 우선됩니다.
   */
  private loadApiKey(): void {
    // 1. localStorage 우선 (사용자가 직접 입력한 키)
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      try {
        // Base64 디코딩 (간단한 난독화)
        this.apiKey = atob(storedKey);
        return;
      } catch (e) {
        console.error('Failed to decode API key from localStorage:', e);
        localStorage.removeItem('gemini_api_key');
      }
    }

    // 2. 환경변수에서 로드 (Vite는 import.meta.env 사용)
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && envKey !== 'PLACEHOLDER_API_KEY') {
      this.apiKey = envKey;
    }
  }

  /**
   * API Key 설정 및 검증
   * 실제 API 호출을 통해 유효성을 확인합니다.
   */
  async setApiKey(key: string): Promise<{ success: boolean; error?: string }> {
    if (!key || key.trim().length === 0) {
      return { success: false, error: 'API Key를 입력해주세요.' };
    }

    try {
      // 실제 API 호출로 검증
      const testAi = new GoogleGenAI({ apiKey: key });
      await testAi.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'test',
        config: { maxOutputTokens: 10 }
      });

      // 검증 성공
      this.apiKey = key;
      this.aiInstance = testAi;
      this.isValidated = true;

      // localStorage에 Base64로 저장 (간단한 난독화)
      localStorage.setItem('gemini_api_key', btoa(key));

      console.log('✅ Gemini API Key가 성공적으로 설정되었습니다.');
      return { success: true };
    } catch (error: any) {
      this.isValidated = false;
      console.error('❌ API Key 검증 실패:', error);

      // 에러 타입별 분류
      if (error?.message?.includes('API key') || error?.message?.includes('INVALID_ARGUMENT')) {
        return { success: false, error: 'API Key가 유효하지 않습니다.' };
      } else if (error?.message?.includes('PERMISSION_DENIED')) {
        return { success: false, error: 'API Key 권한이 없습니다.' };
      } else if (error?.message?.includes('RESOURCE_EXHAUSTED')) {
        return { success: false, error: 'API 할당량이 초과되었습니다.' };
      } else if (error?.message?.includes('UNAVAILABLE')) {
        return { success: false, error: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.' };
      }

      return {
        success: false,
        error: error?.message || '알 수 없는 오류가 발생했습니다.'
      };
    }
  }

  /**
   * GoogleGenAI 인스턴스 반환
   * API Key가 설정되지 않았으면 명확한 에러를 던집니다.
   */
  getAiInstance(): GoogleGenAI {
    if (!this.apiKey) {
      throw new Error(
        'API Key가 설정되지 않았습니다. 설정 메뉴에서 API Key를 입력해주세요.'
      );
    }

    if (!this.aiInstance) {
      this.aiInstance = new GoogleGenAI({ apiKey: this.apiKey });
    }

    return this.aiInstance;
  }

  /**
   * API Key 설정 여부 확인
   */
  isApiKeyConfigured(): boolean {
    return this.apiKey !== null && this.apiKey !== 'PLACEHOLDER_API_KEY';
  }

  /**
   * API Key가 검증되었는지 확인
   */
  isApiKeyValidated(): boolean {
    return this.isValidated;
  }

  /**
   * API Key 제거
   */
  clearApiKey(): void {
    this.apiKey = null;
    this.aiInstance = null;
    this.isValidated = false;
    localStorage.removeItem('gemini_api_key');
    console.log('🗑️ API Key가 제거되었습니다.');
  }

  /**
   * 현재 API Key (마스킹하여 반환)
   */
  getMaskedApiKey(): string | null {
    if (!this.apiKey) return null;
    if (this.apiKey.length < 12) return '***';
    return `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`;
  }

  /**
   * API Key를 다시 로드 (환경변수 변경 후 호출)
   */
  reloadApiKey(): void {
    this.apiKey = null;
    this.aiInstance = null;
    this.isValidated = false;
    this.loadApiKey();
  }
}

export default GeminiAPIManager;

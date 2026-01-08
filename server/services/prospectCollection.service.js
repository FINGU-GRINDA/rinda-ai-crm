import { geminiClient } from './geminiClient.js';
import { logger } from '../utils/logger.js';
import { Type } from '@google/genai';
import { EventEmitter } from 'events';

/**
 * Prospect Collection Service
 * Handles automated lead/prospect collection from PR articles and news
 * Extends EventEmitter for real-time status updates
 */
class ProspectCollectionService extends EventEmitter {
  constructor() {
    super();
    this.status = {
      isRunning: false,
      progress: 0,
      currentStep: '',
      lastRun: null,
      lastResult: null
    };
  }

  /**
   * Collect PR articles based on ICP profiles
   */
  async collectPRArticles(icpProfiles) {
    if (!icpProfiles || icpProfiles.length === 0) {
      return [];
    }

    const modelId = 'gemini-3-flash-preview';
    const allArticles = [];

    for (const icp of icpProfiles) {
      const keywords = icp.keywords?.join(', ') || '';
      const industries = icp.industries?.join(', ') || '';

      const searchQuery = `최근 7일 이내 ${industries} 산업의 ${keywords} 관련 PR 기사, 보도자료, 뉴스`;

      const prompt = `
        다음 검색어로 최근 7일 이내의 PR 기사나 보도자료를 찾아주세요: "${searchQuery}"

        각 기사에 대해 다음 정보를 JSON 배열로 반환해주세요:
        - title: 기사 제목
        - uri: 기사 URL
        - publishedAt: 발행일 (가능한 경우)
        - companyName: 언급된 회사 이름 (추측)
        - summary: 기사 요약 (1-2문장)

        최대 10개의 기사를 반환해주세요.
      `;

      try {
        const response = await geminiClient.generateContent({
          model: modelId,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                articles: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      uri: { type: Type.STRING },
                      publishedAt: { type: Type.STRING },
                      companyName: { type: Type.STRING },
                      summary: { type: Type.STRING }
                    },
                    required: ['title', 'uri']
                  }
                }
              },
              required: ['articles']
            }
          }
        });

        const result = JSON.parse(response.text || '{"articles":[]}');
        const articles = result.articles || [];

        // Tag each article with the ICP profile ID
        articles.forEach(article => {
          article.icpProfileId = icp.id;
        });

        allArticles.push(...articles);
        logger.info(`Collected ${articles.length} articles for ICP "${icp.name}"`);
      } catch (error) {
        logger.error(`Failed to collect articles for ICP "${icp.name}":`, { error: error.message });
      }
    }

    return allArticles;
  }

  /**
   * Analyze articles to identify potential prospects
   */
  async analyzeProspectSignals(articles, icpProfiles, existingCompanyNames = []) {
    if (articles.length === 0) {
      return [];
    }

    const modelId = 'gemini-3-flash-preview';
    const prospects = [];

    // Process articles in batches of 5 to avoid overloading the API
    const batchSize = 5;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      for (const article of batch) {
        const icp = icpProfiles.find(p => p.id === article.icpProfileId);
        if (!icp) continue;

        const prompt = `
          다음 기사를 분석하여 잠재 고객(Prospect)으로서의 가치를 평가해주세요:

          제목: ${article.title}
          요약: ${article.summary || ''}
          회사 이름: ${article.companyName || ''}

          ICP 조건:
          - 산업: ${icp.industries?.join(', ')}
          - 키워드: ${icp.keywords?.join(', ')}
          - 회사 규모: ${icp.companySize || ''}
          - 지역: ${icp.regions?.join(', ') || ''}

          다음 항목을 분석해주세요:
          1. 명확한 회사 이름이 있는가?
          2. ICP와 일치하는가?
          3. 비즈니스 성장 신호가 있는가? (예: 자금 조달, 제품 출시, 확장, 채용)
          4. 신호 강도 (high/medium/low)
          5. 신호 설명

          JSON 형식으로 반환:
          {
            "companyName": "회사 이름",
            "isMatch": true/false,
            "signalStrength": "high/medium/low",
            "signalDescription": "신호 설명"
          }
        `;

        try {
          const response = await geminiClient.generateContent({
            model: modelId,
            contents: prompt,
            config: {
              responseMimeType: 'application/json'
            }
          });

          const analysis = JSON.parse(response.text || '{}');

          // Filter out non-matches and existing companies
          if (
            analysis.isMatch &&
            analysis.companyName &&
            !existingCompanyNames.includes(analysis.companyName) &&
            analysis.signalStrength !== 'low'
          ) {
            const prospect = {
              id: `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              companyName: analysis.companyName,
              source: 'pr_article',
              sourceUrl: article.uri,
              sourceTitle: article.title,
              signalStrength: analysis.signalStrength,
              signalDescription: analysis.signalDescription,
              icpProfileId: icp.id,
              discoveredAt: Date.now(),
              status: 'new'
            };

            prospects.push(prospect);
            logger.info(`Discovered prospect: ${prospect.companyName} (${prospect.signalStrength})`);
          }
        } catch (error) {
          logger.error('Failed to analyze article:', { error: error.message, article: article.title });
        }
      }
    }

    return prospects;
  }

  /**
   * Run complete prospect collection process
   */
  async runCollection(icpProfiles, existingCompanyNames = []) {
    if (this.status.isRunning) {
      throw new Error('Collection is already running');
    }

    this.status.isRunning = true;
    this.status.progress = 0;
    this.status.currentStep = 'Initializing';
    this.emit('status', this.status);

    try {
      // Step 1: Collect articles
      this.status.currentStep = 'Collecting PR articles';
      this.status.progress = 25;
      this.emit('status', this.status);

      logger.info('Starting PR article collection...');
      const articles = await this.collectPRArticles(icpProfiles);
      logger.info(`Collected ${articles.length} articles`);

      // Step 2: Analyze signals
      this.status.currentStep = 'Analyzing prospect signals';
      this.status.progress = 50;
      this.emit('status', this.status);

      logger.info('Analyzing prospect signals...');
      const prospects = await this.analyzeProspectSignals(articles, icpProfiles, existingCompanyNames);
      logger.info(`Discovered ${prospects.length} new prospects`);

      // Step 3: Complete
      this.status.currentStep = 'Complete';
      this.status.progress = 100;
      this.status.lastRun = Date.now();
      this.status.lastResult = {
        newProspects: prospects.length,
        totalArticles: articles.length
      };
      this.emit('status', this.status);

      return {
        newProspects: prospects,
        totalArticles: articles.length
      };
    } catch (error) {
      logger.error('Prospect collection failed:', { error: error.message });
      this.status.currentStep = 'Failed';
      this.emit('status', this.status);
      throw error;
    } finally {
      this.status.isRunning = false;
      this.emit('status', this.status);
    }
  }

  /**
   * Get current collection status
   */
  getCollectionStatus() {
    return this.status;
  }

  /**
   * Run scheduled collection (called by cron job)
   */
  async runScheduledCollection() {
    // In a production system, you would fetch ICP profiles and existing companies from a database
    // For now, this is a placeholder that would need to be implemented with actual data storage
    logger.info('Scheduled prospect collection triggered');

    // This would typically:
    // 1. Load ICP profiles from database
    // 2. Load existing customer/prospect names from database
    // 3. Run collection
    // 4. Save results to database
    // 5. Optionally notify users of new prospects

    return {
      message: 'Scheduled collection requires database integration',
      status: 'pending'
    };
  }
}

// Singleton instance
export const prospectCollectionService = new ProspectCollectionService();

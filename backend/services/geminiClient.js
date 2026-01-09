import { GoogleGenAI } from '@google/genai';
import { retryWithBackoff } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

/**
 * Gemini API Client with retry logic and error handling
 * Singleton instance to manage API calls efficiently
 */
class GeminiClient {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    logger.info('Gemini API Client initialized');
  }

  /**
   * Generate content with retry logic and enhanced error handling
   * @param {Object} config - Gemini API configuration
   * @returns {Promise<Object>} - API response
   */
  async generateContent(config) {
    return retryWithBackoff(
      async () => {
        try {
          const response = await this.ai.models.generateContent(config);
          return response;
        } catch (error) {
          logger.error('Gemini API error:', { error: error.message });

          // Enhanced error classification
          if (error.message?.includes('quota') || error.message?.includes('429')) {
            const quotaError = new Error('API_QUOTA_EXCEEDED');
            quotaError.originalError = error;
            throw quotaError;
          }

          if (error.message?.includes('authentication') || error.message?.includes('401')) {
            const authError = new Error('API_AUTH_FAILED');
            authError.originalError = error;
            throw authError;
          }

          if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
            const timeoutError = new Error('API_TIMEOUT');
            timeoutError.originalError = error;
            throw timeoutError;
          }

          // Network errors (retry-able)
          if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED')) {
            const networkError = new Error('NETWORK_ERROR');
            networkError.originalError = error;
            throw networkError;
          }

          // Generic error
          throw error;
        }
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        shouldRetry: (error) => {
          // Don't retry auth errors or quota errors
          if (error.message === 'API_AUTH_FAILED' || error.message === 'API_QUOTA_EXCEEDED') {
            return false;
          }
          // Retry network errors and timeouts
          return error.message === 'NETWORK_ERROR' || error.message === 'API_TIMEOUT';
        }
      }
    );
  }

  /**
   * Stream generate content (for future real-time responses)
   * @param {Object} config - Gemini API configuration
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<Object>} - Complete response
   */
  async streamGenerateContent(config, onChunk) {
    try {
      const response = await this.ai.models.generateContent({
        ...config,
        stream: true
      });

      let fullText = '';
      for await (const chunk of response.stream) {
        const text = chunk.text || '';
        fullText += text;
        if (onChunk) {
          onChunk(text);
        }
      }

      return { text: fullText, ...response };
    } catch (error) {
      logger.error('Streaming generation failed:', { error: error.message });
      throw error;
    }
  }
}

// Singleton instance
let geminiClientInstance = null;

export function getGeminiClient() {
  if (!geminiClientInstance) {
    geminiClientInstance = new GeminiClient();
  }
  return geminiClientInstance;
}

export const geminiClient = {
  generateContent: (...args) => getGeminiClient().generateContent(...args),
  streamGenerateContent: (...args) => getGeminiClient().streamGenerateContent(...args)
};

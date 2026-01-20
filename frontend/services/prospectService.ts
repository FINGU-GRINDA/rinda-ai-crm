import { ICPProfile, Prospect } from "../types";
import { apiClient } from "../src/services/apiClient";
import { sendNewProspectNotification } from "./slackIntegrationService";

const STORAGE_KEY_ICPS = 'rinda_icp_profiles';
const STORAGE_KEY_PROSPECTS = 'rinda_prospects';
const STORAGE_KEY_COLLECTION_SETTINGS = 'rinda_collection_settings';

export interface CollectionSettings {
  enabled: boolean;
  interval: number; // milliseconds
  autoRun: boolean;
}

// ICP 프로필 로컬 스토리지 관리
export const getICPProfiles = (): ICPProfile[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ICPS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveICPProfiles = (profiles: ICPProfile[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_ICPS, JSON.stringify(profiles));
  } catch (error) {
    console.error('Failed to save ICP profiles:', error);
  }
};

// Prospect 로컬 스토리지 관리
export const getProspects = (): Prospect[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROSPECTS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveProspects = (prospects: Prospect[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_PROSPECTS, JSON.stringify(prospects));
  } catch (error) {
    console.error('Failed to save prospects:', error);
  }
};

// Collection Settings 관리
export const getCollectionSettings = (): CollectionSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COLLECTION_SETTINGS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  // Default settings
  return {
    enabled: true,
    interval: 3600000, // 1 hour
    autoRun: true
  };
};

export const saveCollectionSettings = (settings: CollectionSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY_COLLECTION_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save collection settings:', error);
  }
};

// Run prospect collection using Backend API
export const runProspectCollection = async (
  existingCompanyNames: string[]
): Promise<{ newProspects: Prospect[]; totalArticles: number }> => {
  const icpProfiles = getICPProfiles();

  if (icpProfiles.length === 0) {
    return { newProspects: [], totalArticles: 0 };
  }

  try {
    const result: any = await apiClient.runProspectCollection(
      icpProfiles as unknown as Record<string, unknown>[],
      existingCompanyNames
    );

    // Save new prospects to localStorage
    const existingProspects = getProspects();
    const allProspects = [...existingProspects, ...result.newProspects];
    saveProspects(allProspects);

    // Send Slack notifications for new prospects
    if (result.newProspects && result.newProspects.length > 0) {
      for (const prospect of result.newProspects) {
        // Send notification asynchronously (don't wait)
        sendNewProspectNotification(prospect).catch(err => {
          console.error('Failed to send Slack notification for prospect:', err);
        });
      }
    }

    return {
      newProspects: result.newProspects || [],
      totalArticles: result.totalArticles || 0
    };
  } catch (error: any) {
    console.error('Prospect collection failed:', error);
    throw new Error(error.message || '잠재 고객 수집에 실패했습니다.');
  }
};

// Get collection status from Backend API
export const getCollectionStatus = async (): Promise<any> => {
  try {
    return await apiClient.getProspectStatus();
  } catch (error: any) {
    console.error('Failed to get collection status:', error);
    return {
      isRunning: false,
      progress: 0,
      currentStep: '',
      lastRun: null,
      lastResult: null
    };
  }
};

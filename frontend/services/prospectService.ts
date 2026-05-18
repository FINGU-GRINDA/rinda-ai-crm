import type { ApiProspect } from "../../elysia-server/src/types/api"
import { apiClient } from "../src/services/apiClient"
import { transformApiProspect } from "../src/utils/apiTransformers"
import { isErrorResponse, isSuccessResponse } from "../src/utils/typeGuards"
import type { ICPProfile, Prospect } from "../types"
import { sendNewProspectNotification } from "./slackIntegrationService"

const STORAGE_KEY_ICPS = "rinda_icp_profiles"
const STORAGE_KEY_PROSPECTS = "rinda_prospects"
const STORAGE_KEY_COLLECTION_SETTINGS = "rinda_collection_settings"

export interface CollectionSettings {
  enabled: boolean
  interval: number // milliseconds
  autoRun: boolean
}

export interface CollectionStatus {
  isRunning: boolean
  startedAt: number | null
  finishedAt: number | null
  lastRunDurationMs: number | null
  lastSummary: string | null
  lastCreated: number
  lastSkipped: number
  lastError: string | null
}

// ICP 프로필 로컬 스토리지 관리
export const getICPProfiles = (): ICPProfile[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ICPS)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export const saveICPProfiles = (profiles: ICPProfile[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_ICPS, JSON.stringify(profiles))
  } catch (error) {
    console.error("Failed to save ICP profiles:", error)
  }
}

// Prospect 로컬 스토리지 관리 (legacy local cache, primary source is backend)
export const getProspects = (): Prospect[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROSPECTS)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export const saveProspects = (prospects: Prospect[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_PROSPECTS, JSON.stringify(prospects))
  } catch (error) {
    console.error("Failed to save prospects:", error)
  }
}

// Collection Settings 관리
export const getCollectionSettings = (): CollectionSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COLLECTION_SETTINGS)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  // Default settings - auto-run off by default to avoid surprise API spend
  return {
    enabled: true,
    interval: 21600000, // 6 hours
    autoRun: false,
  }
}

export const saveCollectionSettings = (settings: CollectionSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY_COLLECTION_SETTINGS, JSON.stringify(settings))
  } catch (error) {
    console.error("Failed to save collection settings:", error)
  }
}

interface CollectResponseData {
  newProspects: ApiProspect[]
  totalArticles: number
  skipped?: number
  summary?: string
}

// Run prospect collection using Backend API
export const runProspectCollection = async (
  existingCompanyNames: string[],
): Promise<{
  newProspects: Prospect[]
  totalArticles: number
  skipped: number
  summary: string
}> => {
  const icpProfiles = getICPProfiles()

  if (icpProfiles.length === 0) {
    throw new Error("ICP 프로필이 없습니다. 먼저 ICP 프로필을 추가해주세요.")
  }

  const response = await apiClient.runProspectCollection(
    icpProfiles as unknown as Record<string, unknown>[],
    existingCompanyNames,
  )

  if (isErrorResponse(response)) {
    throw new Error(response.error || "잠재 고객 수집에 실패했습니다.")
  }

  if (!isSuccessResponse(response)) {
    throw new Error("잠재 고객 수집에 실패했습니다.")
  }

  const data = response.data as unknown as CollectResponseData
  const apiProspects = Array.isArray(data.newProspects) ? data.newProspects : []
  const newProspects = apiProspects.map(transformApiProspect)

  // Send Slack notifications for new prospects (fire and forget)
  for (const prospect of newProspects) {
    sendNewProspectNotification(prospect).catch((err) => {
      console.error("Failed to send Slack notification for prospect:", err)
    })
  }

  return {
    newProspects,
    totalArticles: data.totalArticles || 0,
    skipped: data.skipped || 0,
    summary: data.summary || "",
  }
}

// Get collection status from Backend API
export const getCollectionStatus = async (): Promise<CollectionStatus> => {
  const fallback: CollectionStatus = {
    isRunning: false,
    startedAt: null,
    finishedAt: null,
    lastRunDurationMs: null,
    lastSummary: null,
    lastCreated: 0,
    lastSkipped: 0,
    lastError: null,
  }
  try {
    const response = await apiClient.getProspectStatus()
    if (isSuccessResponse(response)) {
      return response.data as unknown as CollectionStatus
    }
    return fallback
  } catch (error) {
    console.error("Failed to get collection status:", error)
    return fallback
  }
}

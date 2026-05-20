/**
 * Slim fetch wrapper for /api/v1/crm/* endpoints.
 *
 * Pulls VITE_API_URL the same way as the legacy APIClient and reuses the
 * `rinda.workspaceId` localStorage key so workspace context stays consistent
 * between the legacy app and the new CRM kanban.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ""
const WORKSPACE_STORAGE_KEY = "rinda.workspaceId"

function readWorkspaceId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiListSuccess<T> {
  success: true
  data: T[]
  count: number
}

export interface ApiError {
  success: false
  error: string
  code?: string
}

export class CrmFetchError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function crmFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  const workspaceId = readWorkspaceId()
  if (workspaceId) headers.set("X-Workspace-Id", workspaceId)

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })

  if (res.status === 401 && !path.includes("/auth/")) {
    window.location.href = "/login"
    throw new CrmFetchError("Session expired", 401)
  }

  const body = (await res.json().catch(() => ({ success: false, error: "Invalid JSON" }))) as
    | ApiSuccess<T>
    | ApiListSuccess<unknown>
    | ApiError

  if (!res.ok || ("success" in body && body.success === false)) {
    const errBody = body as ApiError
    throw new CrmFetchError(errBody.error || `HTTP ${res.status}`, res.status, errBody.code)
  }

  return body as T
}

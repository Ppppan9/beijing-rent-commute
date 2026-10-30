import { DEFAULT_SETTINGS, type AppState, type AppSettings, type CompanyLocation, type RentalListing } from '../types'

const STORAGE_KEY = 'beijing-rent-commute-v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { company: null, listings: [], settings: { ...DEFAULT_SETTINGS }, version: 1 }
    }
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      company: parsed.company ?? null,
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      version: 1,
    }
  } catch {
    return { company: null, listings: [], settings: { ...DEFAULT_SETTINGS }, version: 1 }
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function exportJson(state: AppState): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'beijing-rent-commute',
      ...state,
    },
    null,
    2,
  )
}

export function importJson(text: string): AppState {
  const data = JSON.parse(text) as Partial<AppState> & { listings?: RentalListing[]; company?: CompanyLocation | null; settings?: AppSettings }
  if (!Array.isArray(data.listings) && data.company === undefined) {
    throw new Error('无效的导入文件')
  }
  return {
    company: data.company ?? null,
    listings: Array.isArray(data.listings) ? data.listings : [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    version: 1,
  }
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

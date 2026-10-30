import {
  DEFAULT_SETTINGS,
  type AppState,
  type AppSettings,
  type CompanyLocation,
  type RentalListing,
} from '../types'

/**
 * 主存储键名：自 v1 起固定为 beijing-rent-commute-v1。
 * 部署/改代码不会改这个名字，也不会自动 removeItem / clear。
 * 若将来升 schema，只做 migrate-forward，并继续读写此键（或先读旧键再写入新键，旧键保留）。
 */
export const STORAGE_KEY = 'beijing-rent-commute-v1'
/** 每次成功保存后的镜像，用于主数据解析失败时抢救 */
export const LAST_GOOD_KEY = 'beijing-rent-commute-last-good'
/** 损坏原文备份（永不自动删除用户房源） */
export const CORRUPT_BACKUP_KEY = 'beijing-rent-commute-corrupt-backup'
/** 导出提醒元数据 */
export const BACKUP_META_KEY = 'beijing-rent-commute-backup-meta'
/** 曾用过的键（按旧→新），加载时依次尝试 */
export const LEGACY_STORAGE_KEYS: string[] = []

/** 当前应用 schema 版本；只增不减 */
export const CURRENT_SCHEMA_VERSION = 1

export interface BackupMeta {
  lastExportAt: number | null
  remindedAt: number | null
  listingCountAtRemind: number
}

function emptyState(): AppState {
  return {
    company: null,
    listings: [],
    settings: { ...DEFAULT_SETTINGS },
    version: CURRENT_SCHEMA_VERSION,
  }
}

function isListing(x: unknown): x is RentalListing {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.name === 'string' && typeof o.monthlyRent === 'number'
}

/** 只向前补全缺省字段，绝不丢弃已有 company / listings */
export function migrateState(raw: unknown): AppState {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<AppState> & Record<string, unknown>

  const fromVersion = typeof data.version === 'number' ? data.version : 0

  // —— v0 / 无 version → v1：字段补全 ——
  let company: CompanyLocation | null = null
  if (data.company && typeof data.company === 'object') {
    const c = data.company as CompanyLocation
    if (c.position && typeof c.position.lat === 'number' && typeof c.position.lng === 'number') {
      company = {
        name: c.name || '公司',
        address: c.address || '',
        position: { lat: c.position.lat, lng: c.position.lng },
      }
    }
  }

  const listings: RentalListing[] = Array.isArray(data.listings)
    ? data.listings.filter(isListing).map((l) => ({
        ...l,
        depositMonths: l.depositMonths ?? 1,
        agencyFee: l.agencyFee ?? 0,
        otherMonthly: l.otherMonthly ?? 0,
        workdaysPerMonth: l.workdaysPerMonth ?? 22,
        notes: l.notes ?? '',
        color: l.color || '#e74c3c',
        createdAt: l.createdAt || Date.now(),
      }))
    : []

  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(data.settings && typeof data.settings === 'object' ? data.settings : {}),
    weights: {
      ...DEFAULT_SETTINGS.weights,
      ...(data.settings?.weights ?? {}),
    },
  }

  // 预留：if (fromVersion < 2) { ... } 只追加字段
  void fromVersion

  return {
    company,
    listings,
    settings,
    version: CURRENT_SCHEMA_VERSION,
  }
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.warn('[storage] 写入失败（可能配额已满）', key, e)
  }
}

export function loadBackupMeta(): BackupMeta {
  try {
    const raw = readRaw(BACKUP_META_KEY)
    if (!raw) {
      return { lastExportAt: null, remindedAt: null, listingCountAtRemind: 0 }
    }
    const p = JSON.parse(raw) as Partial<BackupMeta>
    return {
      lastExportAt: typeof p.lastExportAt === 'number' ? p.lastExportAt : null,
      remindedAt: typeof p.remindedAt === 'number' ? p.remindedAt : null,
      listingCountAtRemind: typeof p.listingCountAtRemind === 'number' ? p.listingCountAtRemind : 0,
    }
  } catch {
    return { lastExportAt: null, remindedAt: null, listingCountAtRemind: 0 }
  }
}

export function saveBackupMeta(meta: BackupMeta): void {
  writeRaw(BACKUP_META_KEY, JSON.stringify(meta))
}

export function markExported(): void {
  const meta = loadBackupMeta()
  saveBackupMeta({ ...meta, lastExportAt: Date.now() })
}

export function markReminded(listingCount: number): void {
  const meta = loadBackupMeta()
  saveBackupMeta({ ...meta, remindedAt: Date.now(), listingCountAtRemind: listingCount })
}

/** 房源 ≥5 且超过 7 天未导出（或从未导出）时建议备份 */
export function shouldRemindBackup(listingCount: number): boolean {
  if (listingCount < 5) return false
  const meta = loadBackupMeta()
  const week = 7 * 24 * 60 * 60 * 1000
  if (meta.lastExportAt && Date.now() - meta.lastExportAt < week) return false
  if (meta.remindedAt && Date.now() - meta.remindedAt < week) return false
  return true
}

export function loadState(): AppState {
  const keys = [STORAGE_KEY, LAST_GOOD_KEY, ...LEGACY_STORAGE_KEYS]
  for (const key of keys) {
    const raw = readRaw(key)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      const state = migrateState(parsed)
      // 若从镜像/旧键恢复，写回主键（不删旧键）
      if (key !== STORAGE_KEY) {
        saveState(state)
      }
      return state
    } catch (e) {
      console.warn(`[storage] 解析 ${key} 失败，尝试下一来源`, e)
      // 主键损坏时留下原文，便于人工抢救
      if (key === STORAGE_KEY) {
        writeRaw(CORRUPT_BACKUP_KEY, raw)
      }
    }
  }
  // 没有任何可读数据才返回空；绝不在更新时主动清空
  return emptyState()
}

export function saveState(state: AppState): void {
  const normalized: AppState = {
    ...state,
    version: CURRENT_SCHEMA_VERSION,
    listings: Array.isArray(state.listings) ? state.listings : [],
  }
  // 安全网：若新状态房源为空，但本地已有大量房源，拒绝覆盖（防止异常逻辑误清空）
  try {
    const existingRaw = readRaw(STORAGE_KEY)
    if (existingRaw && normalized.listings.length === 0) {
      const prev = migrateState(JSON.parse(existingRaw))
      if (prev.listings.length > 0 && !normalized.company) {
        // 允许用户主动删光房源且清空公司；若仅 listings 空但仍有公司则正常保存
      }
      // 若调用方显式保存空 listings（用户删光），允许；不做拦截。
      // 真正防误清空靠：从不自动 clear、migrate 不丢字段、损坏时读 last-good。
    }
  } catch {
    /* ignore */
  }

  const payload = JSON.stringify(normalized)
  writeRaw(STORAGE_KEY, payload)
  writeRaw(LAST_GOOD_KEY, payload)
}

export function exportJson(state: AppState): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'beijing-rent-commute',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      storageKey: STORAGE_KEY,
      ...state,
      version: CURRENT_SCHEMA_VERSION,
    },
    null,
    2,
  )
}

export function downloadExport(state: AppState, filename?: string): void {
  const blob = new Blob([exportJson(state)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download =
    filename || `beijing-rent-commute-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  markExported()
}

export function importJson(text: string): AppState {
  const data = JSON.parse(text) as unknown
  const state = migrateState(data)
  if (!state.listings.length && !state.company) {
    // 再宽松一点：只要原文件带 listings 数组也接受
    const raw = data as { listings?: unknown; company?: unknown }
    if (!Array.isArray(raw.listings) && raw.company === undefined) {
      throw new Error('无效的导入文件')
    }
  }
  return state
}

/**
 * 仅在用户明确确认后调用。会备份当前数据到 corrupt/备份键后再清空主数据。
 */
export function resetAllData(confirmed: boolean): void {
  if (!confirmed) return
  const raw = readRaw(STORAGE_KEY)
  if (raw) {
    writeRaw(
      `beijing-rent-commute-user-reset-${new Date().toISOString().slice(0, 10)}`,
      raw,
    )
  }
  writeRaw(STORAGE_KEY, JSON.stringify(emptyState()))
  writeRaw(LAST_GOOD_KEY, JSON.stringify(emptyState()))
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

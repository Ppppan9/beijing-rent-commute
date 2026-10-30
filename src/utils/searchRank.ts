/** 北京地址/小区搜索：按名称相似度排序，过滤无关模糊命中 */

const NOISE_SUFFIXES = [
  '酒店式公寓',
  '服务式公寓',
  '公寓酒店',
  '精品酒店',
  '商务酒店',
  '国际公寓',
  '青年公寓',
  '住宅小区',
  '酒店公寓',
  '公寓',
  '小区',
  '酒店',
  '宾馆',
  '大厦',
  '广场',
  '中心',
  '花园',
  '家园',
  '新村',
  '别墅',
]

export function stripNoiseSuffix(q: string): string {
  let s = q.trim()
  // 反复剥常见后缀，保留品牌/核心词（如 呈柿）
  let changed = true
  while (changed) {
    changed = false
    for (const suf of NOISE_SUFFIXES) {
      if (s.endsWith(suf) && s.length > suf.length + 1) {
        s = s.slice(0, -suf.length)
        changed = true
        break
      }
    }
  }
  return s.trim()
}

/** 生成补充查询：全词 + 去后缀核心词 + 前 2～4 字 */
export function queryVariants(keywords: string): string[] {
  const raw = keywords.trim()
  if (!raw) return []
  const out: string[] = [raw]
  const core = stripNoiseSuffix(raw)
  if (core && core !== raw) out.push(core)
  // 短核心：呈柿酒店 → 呈柿
  if (core.length >= 4) {
    out.push(core.slice(0, 2))
    out.push(core.slice(0, Math.min(4, core.length)))
  } else if (core.length >= 2) {
    out.push(core.slice(0, 2))
  }
  // 去重保序
  const seen = new Set<string>()
  return out.filter((v) => {
    if (!v || seen.has(v)) return false
    seen.add(v)
    return true
  })
}

function charsOf(s: string): string[] {
  return [...s].filter((c) => c.trim())
}

/**
 * 0–100：名称与查询的相关度。
 * 核心词（去「酒店式公寓」等噪声后）必须尽量命中，否则分数极低。
 */
export function nameRelevance(query: string, name: string): number {
  const q = query.trim().toLowerCase()
  const n = name.trim().toLowerCase()
  if (!q || !n) return 0

  if (n === q) return 100
  if (n.includes(q)) return 96
  if (q.includes(n) && n.length >= 2) return 92

  const core = stripNoiseSuffix(q).toLowerCase()
  if (core.length >= 2) {
    if (n.includes(core)) return 90
    // 核心字覆盖率
    const coreChars = charsOf(core)
    const hit = coreChars.filter((c) => n.includes(c)).length
    const cover = hit / coreChars.length
    if (cover < 0.5) {
      // 核心词大半不在名称里 → 视为无关（高德常靠「公寓」泛匹配）
      return Math.round(cover * 15)
    }
    if (cover >= 1) return 85
    if (cover >= 0.75) return 70
    return Math.round(40 + cover * 30)
  }

  // 无有效核心时退回整词字符覆盖
  const qChars = charsOf(q)
  const hit = qChars.filter((c) => n.includes(c)).length
  return Math.round((hit / Math.max(qChars.length, 1)) * 50)
}

export interface RankedHit {
  name: string
  address: string
  lat: number
  lng: number
  district?: string
  source?: string
  score: number
}

/** 过滤并按相关度排序；若最高分过低则返回空（诚实无结果） */
export function rankAndFilter<T extends { name: string }>(
  query: string,
  items: T[],
  minKeep = 40,
): (T & { score: number })[] {
  const scored = items.map((it) => ({ ...it, score: nameRelevance(query, it.name) }))
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]?.score ?? 0
  if (best < minKeep) return []
  // 有高分命中时，丢掉明显无关的尾巴
  const threshold = Math.max(minKeep, best - 45)
  return scored.filter((s) => s.score >= threshold)
}

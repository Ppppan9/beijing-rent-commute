import type {
  AppSettings,
  CommuteInfo,
  RentalListing,
  ScoredListing,
} from '../types'
import { calcCostBreakdown } from './cost'

function preferredDuration(c: CommuteInfo | null, preferred: 'transit' | 'driving'): number {
  if (!c) return 120 // 无路线按 2 小时惩罚
  if (preferred === 'driving' && c.driving) return c.driving.durationMin
  if (c.transit) return c.transit.durationMin
  if (c.driving) return c.driving.durationMin
  return 120
}

function normalizeInvert(values: number[]): number[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 80)
  // 越小越好 → 高分
  return values.map((v) => ((max - v) / (max - min)) * 100)
}

function normalizeDirect(values: number[]): number[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 80)
  return values.map((v) => ((v - min) / (max - min)) * 100)
}

/**
 * 性价比得分（0–100）：
 * - 通勤时间权重（默认 40%）：越短越好
 * - 有效月成本权重（默认 45%）：越低越好
 * - 面积性价比（㎡ / 有效月成本，默认 15%）：越高越好；无面积则均分给通勤与成本
 */
export function scoreListings(
  listings: RentalListing[],
  commuteMap: Record<string, CommuteInfo | null>,
  settings: AppSettings,
): ScoredListing[] {
  if (listings.length === 0) return []

  const costs = listings.map((l) =>
    calcCostBreakdown(l, commuteMap[l.id] ?? null, settings),
  )
  const durations = listings.map((l) =>
    preferredDuration(commuteMap[l.id] ?? null, settings.preferredMode),
  )

  const hasAnySize = listings.some((l) => l.sizeSqm && l.sizeSqm > 0)
  let wCommute = settings.weights.commute
  let wCost = settings.weights.cost
  let wSize = hasAnySize ? settings.weights.size : 0
  if (!hasAnySize) {
    const s = wCommute + wCost
    wCommute = wCommute / s
    wCost = wCost / s
  } else {
    const s = wCommute + wCost + wSize
    wCommute /= s
    wCost /= s
    wSize /= s
  }

  const commuteScores = normalizeInvert(durations)
  const costScores = normalizeInvert(costs.map((c) => c.effectiveMonthly))
  const sizePerCost = listings.map((l, i) => {
    if (!l.sizeSqm || l.sizeSqm <= 0) return 0
    return l.sizeSqm / Math.max(costs[i].effectiveMonthly, 1)
  })
  const sizeScores = hasAnySize ? normalizeDirect(sizePerCost) : listings.map(() => 0)

  const scored: ScoredListing[] = listings.map((listing, i) => {
    const valueScore =
      Math.round(
        (commuteScores[i] * wCommute + costScores[i] * wCost + sizeScores[i] * wSize) * 10,
      ) / 10
    return {
      listing,
      commute: commuteMap[listing.id] ?? null,
      cost: costs[i],
      valueScore,
      rank: 0,
      scoreDetail: {
        commuteScore: Math.round(commuteScores[i] * 10) / 10,
        costScore: Math.round(costScores[i] * 10) / 10,
        sizeScore: Math.round(sizeScores[i] * 10) / 10,
      },
    }
  })

  scored.sort((a, b) => b.valueScore - a.valueScore)
  scored.forEach((s, idx) => {
    s.rank = idx + 1
  })
  return scored
}

import type { CommuteInfo, CommuteRoute, LatLng } from '../types'
import {
  amapDriving,
  amapGeocode,
  amapInputTips,
  amapSearch,
  amapTransit,
  amapWalking,
  hasAmapKey,
} from './amap'
import type { GeoResult } from './amap'
import {
  demoSearch,
  estimateDrivingFallback,
  estimateTransit,
  haversineKm,
  osrmDriving,
} from './demoGeo'
import { nameRelevance, queryVariants, rankAndFilter } from '../utils/searchRank'

function toDriving(
  raw: {
    durationMin: number
    distanceKm: number
    path: [number, number][]
    summary?: string
  },
  from: LatLng,
  to: LatLng,
  estimated: boolean,
): CommuteRoute {
  return {
    mode: 'driving',
    durationMin: raw.durationMin,
    distanceKm: raw.distanceKm,
    path: raw.path.length ? raw.path : [[from.lat, from.lng], [to.lat, to.lng]],
    summary: raw.summary,
    estimated,
  }
}

function toTransit(
  raw: {
    durationMin: number
    distanceKm: number
    path: [number, number][]
    summary?: string
  },
  from: LatLng,
  to: LatLng,
  estimated: boolean,
): CommuteRoute {
  return {
    mode: 'transit',
    durationMin: raw.durationMin,
    distanceKm: raw.distanceKm,
    path: raw.path.length ? raw.path : [[from.lat, from.lng], [to.lat, to.lng]],
    summary: raw.summary,
    estimated,
  }
}

async function demoCommute(from: LatLng, to: LatLng): Promise<CommuteInfo> {
  const osrm = await osrmDriving(from, to)
  const driving = osrm
    ? toDriving({ ...osrm, summary: 'OSRM 驾车路线（演示）' }, from, to, true)
    : toDriving(estimateDrivingFallback(from, to), from, to, true)

  return {
    driving,
    transit: toTransit(estimateTransit(from, to), from, to, true),
    preferred: 'transit',
  }
}

function amapSoftEstimate(from: LatLng, to: LatLng): CommuteInfo {
  return {
    driving: toDriving(estimateDrivingFallback(from, to), from, to, true),
    transit: toTransit(estimateTransit(from, to), from, to, true),
    preferred: 'transit',
  }
}

export async function fetchCommute(from: LatLng, to: LatLng): Promise<CommuteInfo> {
  if (!hasAmapKey()) {
    return demoCommute(from, to)
  }

  const dist = haversineKm(from, to)
  const tasks: Promise<unknown>[] = [amapDriving(from, to), amapTransit(from, to)]
  if (dist <= 3) tasks.push(amapWalking(from, to))

  const [drivingRaw, transitRaw, walkingRaw] = (await Promise.all(tasks)) as [
    Awaited<ReturnType<typeof amapDriving>>,
    Awaited<ReturnType<typeof amapTransit>>,
    Awaited<ReturnType<typeof amapWalking>> | undefined,
  ]

  if (drivingRaw || transitRaw) {
    const transit = transitRaw
      ? toTransit(transitRaw, from, to, false)
      : walkingRaw && dist <= 1.5
        ? {
            mode: 'transit' as const,
            durationMin: walkingRaw.durationMin,
            distanceKm: walkingRaw.distanceKm,
            path: walkingRaw.path.length
              ? walkingRaw.path
              : ([[from.lat, from.lng], [to.lat, to.lng]] as [number, number][]),
            summary: walkingRaw.summary,
            estimated: false,
          }
        : undefined

    return {
      driving: drivingRaw ? toDriving(drivingRaw, from, to, false) : undefined,
      transit,
      preferred: transit ? 'transit' : 'driving',
    }
  }

  console.warn('[高德] 路线接口无结果，使用本地估算（未调用 OSRM）')
  return amapSoftEstimate(from, to)
}

function dedupe(list: GeoResult[]): GeoResult[] {
  const seen = new Set<string>()
  const out: GeoResult[] = []
  for (const r of list) {
    const k = `${r.name}|${r.lat.toFixed(4)},${r.lng.toFixed(4)}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

/**
 * 北京地点搜索：多查询变体 + 相关度过滤。
 * 有高德 Key 时绝不回退 Nominatim；无可靠命中则返回 []（UI 提示地图点选）。
 */
export async function searchPlaces(keywords: string): Promise<GeoResult[]> {
  const q = keywords.trim()
  if (!q) return []

  if (!hasAmapKey()) {
    return rankAndFilter(q, await demoSearch(q)).map(({ score: _s, ...r }) => r)
  }

  const variants = queryVariants(q)
  // 1) 对每个变体拉 inputtips（呈柿酒店式公寓 → 呈柿 才能命中品牌）
  const tipBatches = await Promise.all(variants.map((v) => amapInputTips(v)))
  let merged = dedupe(tipBatches.flat())

  // 2) 仅当 tips 相关度不足时，再用 place/text（避免「公寓」泛匹配污染）
  const tipBest = merged.reduce((m, r) => Math.max(m, nameRelevance(q, r.name)), 0)
  if (tipBest < 70) {
    const placeQueries = variants.slice(0, 2)
    const placeBatches = await Promise.all(
      placeQueries.flatMap((v) => [amapSearch(v, true), amapSearch(v, false)]),
    )
    merged = dedupe([...merged, ...placeBatches.flat()])
  }

  let ranked = rankAndFilter(q, merged, 40)

  // 3) 仍无可靠结果 → geocode（同样过滤）
  if (ranked.length === 0) {
    const geos = await amapGeocode(q)
    ranked = rankAndFilter(q, geos, 40)
    // geocode 常把整句糊成无关 POI；核心词不在地址里则丢弃
    if (ranked.length === 0) {
      const coreGeos = await Promise.all(
        variants.slice(1, 3).map((v) => amapGeocode(v)),
      )
      ranked = rankAndFilter(q, dedupe(coreGeos.flat()), 50)
    }
  }

  return ranked.slice(0, 10).map(({ score: _s, ...r }) => r as GeoResult)
}

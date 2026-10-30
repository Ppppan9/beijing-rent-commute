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

/** 仅无高德 Key 时使用（OSRM / 本地估算） */
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

/** 有高德 Key 时绝不调用 OSRM/Nominatim；接口失败则用本地几何估算 */
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
  // 短距离补充步行（高德 walking）
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

export async function searchPlaces(keywords: string): Promise<GeoResult[]> {
  if (!hasAmapKey()) {
    return demoSearch(keywords)
  }

  const seen = new Set<string>()
  const merged: GeoResult[] = []
  const add = (list: GeoResult[]) => {
    for (const r of list) {
      const k = `${r.name}|${r.lat.toFixed(4)},${r.lng.toFixed(4)}`
      if (!seen.has(k)) {
        seen.add(k)
        merged.push(r)
      }
    }
  }

  // 并行：输入提示 + 住宅 POI + 全类型 POI
  const [tips, residential, general] = await Promise.all([
    amapInputTips(keywords),
    amapSearch(keywords, true),
    amapSearch(keywords, false),
  ])
  add(tips)
  add(residential)
  add(general)

  if (merged.length === 0) {
    add(await amapGeocode(keywords))
  }

  // 有高德 Key 时不回退 Nominatim/OSM
  return merged.slice(0, 12)
}

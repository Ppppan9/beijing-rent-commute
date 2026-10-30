import type { CommuteInfo, CommuteRoute, LatLng } from '../types'
import { amapDriving, amapGeocode, amapInputTips, amapSearch, amapTransit, hasAmapKey } from './amap'
import type { GeoResult } from './amap'
import {
  demoSearch,
  estimateDrivingFallback,
  estimateTransit,
  osrmDriving,
} from './demoGeo'

function toDriving(raw: {
  durationMin: number
  distanceKm: number
  path: [number, number][]
  summary?: string
}, from: LatLng, to: LatLng, estimated: boolean): CommuteRoute {
  return {
    mode: 'driving',
    durationMin: raw.durationMin,
    distanceKm: raw.distanceKm,
    path: raw.path.length ? raw.path : [[from.lat, from.lng], [to.lat, to.lng]],
    summary: raw.summary,
    estimated,
  }
}

function toTransit(raw: {
  durationMin: number
  distanceKm: number
  path: [number, number][]
  summary?: string
}, from: LatLng, to: LatLng, estimated: boolean): CommuteRoute {
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
    ? toDriving(
        { ...osrm, summary: 'OSRM 驾车路线（演示）' },
        from,
        to,
        true,
      )
    : toDriving(estimateDrivingFallback(from, to), from, to, true)

  return {
    driving,
    transit: toTransit(estimateTransit(from, to), from, to, true),
    preferred: 'transit',
  }
}

export async function fetchCommute(from: LatLng, to: LatLng): Promise<CommuteInfo> {
  if (hasAmapKey()) {
    const [drivingRaw, transitRaw] = await Promise.all([
      amapDriving(from, to),
      amapTransit(from, to),
    ])

    if (drivingRaw || transitRaw) {
      return {
        driving: drivingRaw ? toDriving(drivingRaw, from, to, false) : undefined,
        transit: transitRaw ? toTransit(transitRaw, from, to, false) : undefined,
        preferred: transitRaw ? 'transit' : 'driving',
      }
    }
    // Key present but APIs failed — soft-fallback so UI still shows routes
    console.warn('[高德] 路线接口无结果，回退演示估算')
    return demoCommute(from, to)
  }

  return demoCommute(from, to)
}

export async function searchPlaces(keywords: string): Promise<GeoResult[]> {
  if (hasAmapKey()) {
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
    add(await amapInputTips(keywords))
    if (merged.length < 3) add(await amapSearch(keywords))
    if (merged.length === 0) add(await amapGeocode(keywords))
    if (merged.length) return merged.slice(0, 12)
    return demoSearch(keywords)
  }
  return demoSearch(keywords)
}

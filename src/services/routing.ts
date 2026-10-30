import type { CommuteInfo, CommuteRoute, LatLng } from '../types'
import { amapDriving, amapGeocode, amapSearch, amapTransit, hasAmapKey } from './amap'
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

export async function searchPlaces(keywords: string) {
  if (hasAmapKey()) {
    const [pois, geos] = await Promise.all([amapSearch(keywords), amapGeocode(keywords)])
    const merged = [...pois]
    const seen = new Set(pois.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`))
    for (const g of geos) {
      const k = `${g.lat.toFixed(4)},${g.lng.toFixed(4)}`
      if (!seen.has(k)) {
        merged.push(g)
        seen.add(k)
      }
    }
    if (merged.length) return merged
    // Soft fallback if Amap search empty
    return demoSearch(keywords)
  }
  return demoSearch(keywords)
}

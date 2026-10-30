import type { CommuteInfo, CommuteRoute, LatLng } from '../types'
import { amapDriving, amapGeocode, amapSearch, amapTransit, hasAmapKey } from './amap'
import {
  demoSearch,
  estimateDrivingFallback,
  estimateTransit,
  osrmDriving,
} from './demoGeo'

export async function fetchCommute(from: LatLng, to: LatLng): Promise<CommuteInfo> {
  if (hasAmapKey()) {
    const [drivingRaw, transitRaw] = await Promise.all([
      amapDriving(from, to),
      amapTransit(from, to),
    ])
    const driving: CommuteRoute | undefined = drivingRaw
      ? {
          mode: 'driving',
          durationMin: drivingRaw.durationMin,
          distanceKm: drivingRaw.distanceKm,
          path: drivingRaw.path.length
            ? drivingRaw.path
            : ([[from.lat, from.lng], [to.lat, to.lng]] as [number, number][]),
          summary: drivingRaw.summary,
          estimated: false,
        }
      : undefined
    const transit: CommuteRoute | undefined = transitRaw
      ? {
          mode: 'transit',
          durationMin: transitRaw.durationMin,
          distanceKm: transitRaw.distanceKm,
          path: transitRaw.path.length
            ? transitRaw.path
            : ([[from.lat, from.lng], [to.lat, to.lng]] as [number, number][]),
          summary: transitRaw.summary,
          estimated: false,
        }
      : undefined

    return {
      driving,
      transit,
      preferred: transit ? 'transit' : 'driving',
    }
  }

  const osrm = await osrmDriving(from, to)
  const drivingEst = osrm
    ? {
        mode: 'driving' as const,
        durationMin: osrm.durationMin,
        distanceKm: osrm.distanceKm,
        path: osrm.path,
        summary: 'OSRM 驾车路线（演示）',
        estimated: true,
      }
    : {
        mode: 'driving' as const,
        ...estimateDrivingFallback(from, to),
      }

  const transitEst = {
    mode: 'transit' as const,
    ...estimateTransit(from, to),
  }

  return {
    driving: drivingEst,
    transit: transitEst,
    preferred: 'transit',
  }
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
    return merged
  }
  return demoSearch(keywords)
}

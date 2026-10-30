import { BEIJING_LANDMARKS, type LatLng } from '../types'
import type { GeoResult } from './amap'

/** 演示模式：关键词匹配地标 + Nominatim 北京范围搜索 */
export async function demoSearch(keywords: string): Promise<GeoResult[]> {
  const q = keywords.trim().toLowerCase()
  if (!q) return []

  const local = BEIJING_LANDMARKS.filter(
    (l) =>
      l.name.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q) ||
      q.split(/\s+/).some((w) => l.name.includes(w) || l.address.includes(w)),
  ).map((l) => ({ name: l.name, address: l.address, lat: l.position.lat, lng: l.position.lng }))

  if (local.length >= 3) return local.slice(0, 8)

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keywords + ' 北京')}&limit=6&countrycodes=cn&viewbox=115.7,41.0,117.4,39.4&bounded=1`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return local
    const data = (await res.json()) as { display_name: string; lat: string; lon: string; name?: string }[]
    const remote = data.map((d) => ({
      name: d.name || d.display_name.split(',')[0],
      address: d.display_name,
      lat: Number(d.lat),
      lng: Number(d.lon),
    }))
    // 去重
    const seen = new Set(local.map((x) => `${x.lat.toFixed(4)},${x.lng.toFixed(4)}`))
    for (const r of remote) {
      const k = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`
      if (!seen.has(k)) {
        local.push(r)
        seen.add(k)
      }
    }
  } catch {
    /* ignore network errors in demo */
  }
  return local.slice(0, 8)
}

/** Haversine 距离 km */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 直线插值路径（演示） */
export function straightPath(a: LatLng, b: LatLng, n = 24): [number, number][] {
  const path: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    path.push([a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t])
  }
  return path
}

/** OSRM 驾车路线（公开 demo 服务，可能限流） */
export async function osrmDriving(
  from: LatLng,
  to: LatLng,
): Promise<{ durationMin: number; distanceKm: number; path: [number, number][] } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null
    const coords = (route.geometry.coordinates as [number, number][]).map(
      ([lng, lat]) => [lat, lng] as [number, number],
    )
    return {
      durationMin: Math.round(route.duration / 60),
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      path: coords,
    }
  } catch {
    return null
  }
}

/** 演示公交估算：距离 × 路网系数，速度约 22km/h + 换乘缓冲 */
export function estimateTransit(from: LatLng, to: LatLng) {
  const straight = haversineKm(from, to)
  const roadFactor = 1.45
  const distanceKm = Math.round(straight * roadFactor * 10) / 10
  const durationMin = Math.round(distanceKm / 22 * 60 + 12) // +12min 步行换乘
  return {
    durationMin,
    distanceKm,
    path: straightPath(from, to),
    summary: '演示估算（配置高德 Key 可获真实公交线）',
    estimated: true as const,
  }
}

export function estimateDrivingFallback(from: LatLng, to: LatLng) {
  const straight = haversineKm(from, to)
  const distanceKm = Math.round(straight * 1.35 * 10) / 10
  const durationMin = Math.round((distanceKm / 28) * 60 + 5)
  return {
    durationMin,
    distanceKm,
    path: straightPath(from, to),
    summary: '演示估算驾车路线',
    estimated: true as const,
  }
}

/** 高德地图 Key 检测与 REST 封装（无后端，浏览器直调需在控制台配置安全密钥/Referer） */

export function getAmapKey(): string | undefined {
  const key = import.meta.env.VITE_AMAP_KEY as string | undefined
  return key && key.trim() && key !== 'your_amap_key_here' ? key.trim() : undefined
}

export function hasAmapKey(): boolean {
  return !!getAmapKey()
}

export interface GeoResult {
  name: string
  address: string
  lat: number
  lng: number
}

/** 高德地理编码 */
export async function amapGeocode(address: string): Promise<GeoResult[]> {
  const key = getAmapKey()
  if (!key) return []
  const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}&city=北京&key=${key}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== '1' || !data.geocodes?.length) return []
  return data.geocodes.map((g: { formatted_address: string; location: string }) => {
    const [lng, lat] = g.location.split(',').map(Number)
    return { name: g.formatted_address, address: g.formatted_address, lat, lng }
  })
}

/** 高德关键词搜索 POI */
export async function amapSearch(keywords: string): Promise<GeoResult[]> {
  const key = getAmapKey()
  if (!key) return []
  const url = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keywords)}&city=北京&offset=8&key=${key}&extensions=base`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== '1' || !data.pois?.length) return []
  return data.pois
    .filter((p: { location: string }) => p.location)
    .map((p: { name: string; address: string; pname?: string; cityname?: string; adname?: string; location: string }) => {
      const [lng, lat] = p.location.split(',').map(Number)
      const address = [p.pname, p.cityname, p.adname, p.address].filter(Boolean).join('')
      return { name: p.name, address: address || p.name, lat, lng }
    })
}

export interface AmapRouteResult {
  durationMin: number
  distanceKm: number
  path: [number, number][]
  summary?: string
}

function decodePolyline(steps: { polyline: string }[]): [number, number][] {
  const path: [number, number][] = []
  for (const step of steps) {
    if (!step.polyline) continue
    for (const pair of step.polyline.split(';')) {
      const [lng, lat] = pair.split(',').map(Number)
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) path.push([lat, lng])
    }
  }
  return path
}

export async function amapDriving(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<AmapRouteResult | null> {
  const key = getAmapKey()
  if (!key) return null
  const origin = `${from.lng},${from.lat}`
  const destination = `${to.lng},${to.lat}`
  const url = `https://restapi.amap.com/v3/direction/driving?origin=${origin}&destination=${destination}&extensions=all&key=${key}`
  const res = await fetch(url)
  const data = await res.json()
  const path0 = data.route?.paths?.[0]
  if (data.status !== '1' || !path0) return null
  return {
    durationMin: Math.round(Number(path0.duration) / 60),
    distanceKm: Math.round((Number(path0.distance) / 1000) * 10) / 10,
    path: decodePolyline(path0.steps || []),
    summary: `驾车约 ${Math.round(Number(path0.duration) / 60)} 分钟`,
  }
}

export async function amapTransit(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<AmapRouteResult | null> {
  const key = getAmapKey()
  if (!key) return null
  const origin = `${from.lng},${from.lat}`
  const destination = `${to.lng},${to.lat}`
  const url = `https://restapi.amap.com/v3/direction/transit/integrated?origin=${origin}&destination=${destination}&city=北京&key=${key}`
  const res = await fetch(url)
  const data = await res.json()
  const trans = data.route?.transits?.[0]
  if (data.status !== '1' || !trans) return null

  const path: [number, number][] = []
  const names: string[] = []
  for (const seg of trans.segments || []) {
    if (seg.walking?.steps) {
      for (const s of seg.walking.steps) {
        if (!s.polyline) continue
        for (const pair of s.polyline.split(';')) {
          const [lng, lat] = pair.split(',').map(Number)
          if (!Number.isNaN(lat)) path.push([lat, lng])
        }
      }
    }
    if (seg.bus?.buslines) {
      for (const line of seg.bus.buslines) {
        names.push(line.name)
        if (!line.polyline) continue
        for (const pair of line.polyline.split(';')) {
          const [lng, lat] = pair.split(',').map(Number)
          if (!Number.isNaN(lat)) path.push([lat, lng])
        }
      }
    }
    if (seg.railway) {
      names.push(seg.railway.name || '铁路')
    }
  }

  return {
    durationMin: Math.round(Number(trans.duration) / 60),
    distanceKm: Math.round((Number(trans.distance || data.route.distance) / 1000) * 10) / 10,
    path,
    summary: names.length ? names.slice(0, 4).join(' → ') : '公共交通',
  }
}

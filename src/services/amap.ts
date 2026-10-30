/** 高德 Web 服务 Key（构建时由 VITE_AMAP_KEY 注入；浏览器直调需控制台配置域名/IP 白名单） */

export function getAmapKey(): string | undefined {
  const key = import.meta.env.VITE_AMAP_KEY as string | undefined
  return key && key.trim() && key !== 'your_amap_key_here' ? key.trim() : undefined
}

export function hasAmapKey(): boolean {
  return !!getAmapKey()
}

/** Web端(JS API) Key — 官方矢量底图；与 Web服务 Key 不同 */
export function getAmapJsKey(): string | undefined {
  const key = import.meta.env.VITE_AMAP_JS_KEY as string | undefined
  return key && key.trim() && key !== 'your_amap_js_key_here' ? key.trim() : undefined
}

export function hasAmapJsKey(): boolean {
  return !!getAmapJsKey()
}

export function getAmapSecurityCode(): string | undefined {
  const code = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined
  return code && code.trim() ? code.trim() : undefined
}

export interface GeoResult {
  name: string
  address: string
  lat: number
  lng: number
  district?: string
  source?: string
}

function parseLoc(loc: unknown): { lat: number; lng: number } | null {
  if (typeof loc !== 'string' || !loc.includes(',')) return null
  const [lng, lat] = loc.split(',').map(Number)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

/** 输入提示（北京限定），无坐标的 tip 通过 place/detail 补全 */
export async function amapInputTips(keywords: string): Promise<GeoResult[]> {
  const key = getAmapKey()
  if (!key) return []
  try {
    const url = `https://restapi.amap.com/v3/assistant/inputtips?keywords=${encodeURIComponent(keywords)}&city=北京&citylimit=true&datatype=all&key=${key}`
    const data = await (await fetch(url)).json()
    if (data.status !== '1' || !Array.isArray(data.tips)) return []
    const tips = data.tips as { id?: string; name: string; district?: string; address?: unknown; location?: unknown }[]
    const out = await Promise.all(
      tips.slice(0, 10).map(async (tip) => {
        let loc = parseLoc(tip.location)
        if (!loc && typeof tip.id === 'string' && tip.id) {
          loc = await amapPlaceDetail(tip.id)
        }
        if (!loc) {
          try {
            const q = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(tip.name)}&city=北京&citylimit=true&offset=1&key=${key}&extensions=base`
            const d = await (await fetch(q)).json()
            const poi = d.pois?.[0]
            const pl = parseLoc(poi?.location)
            if (pl) loc = pl
          } catch { /* ignore */ }
        }
        if (!loc) return null
        const addr = typeof tip.address === 'string' ? tip.address : ''
        return {
          name: tip.name,
          district: tip.district || '',
          address: `${tip.district || ''}${addr}` || tip.name,
          lat: loc.lat,
          lng: loc.lng,
          source: 'tips',
        } as GeoResult
      }),
    )
    return out.filter((x): x is GeoResult => !!x)
  } catch (e) {
    console.warn('[高德] inputtips 错误', e)
    return []
  }
}

export async function amapPlaceDetail(id: string): Promise<{ lat: number; lng: number } | null> {
  const key = getAmapKey()
  if (!key) return null
  try {
    const data = await (await fetch(`https://restapi.amap.com/v3/place/detail?id=${encodeURIComponent(id)}&key=${key}`)).json()
    return parseLoc(data.pois?.[0]?.location)
  } catch {
    return null
  }
}

function warnAmap(api: string, data: { status?: string; info?: string; infocode?: string }) {
  if (data.status === '1') return
  console.warn(`[高德] ${api} 失败:`, data.info || data.infocode || data.status)
}

/** 高德地理编码 */
export async function amapGeocode(address: string): Promise<GeoResult[]> {
  const key = getAmapKey()
  if (!key) return []
  try {
    const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}&city=北京&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    warnAmap('geocode', data)
    if (data.status !== '1' || !data.geocodes?.length) return []
    return data.geocodes.map((g: { formatted_address: string; location: string }) => {
      const [lng, lat] = g.location.split(',').map(Number)
      return { name: g.formatted_address, address: g.formatted_address, lat, lng, source: 'geocode' }
    })
  } catch (e) {
    console.warn('[高德] geocode 网络错误', e)
    return []
  }
}

/** 高德关键词搜索 POI */
export async function amapSearch(keywords: string, preferResidential = true): Promise<GeoResult[]> {
  const key = getAmapKey()
  if (!key) return []
  try {
    const types = preferResidential
      ? `&types=${encodeURIComponent('120000|120300|120302|120303|120200|170000|190000|150000')}`
      : ''
    const url = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keywords)}&city=北京&citylimit=true${types}&offset=12&key=${key}&extensions=base`
    const res = await fetch(url)
    const data = await res.json()
    warnAmap('place/text', data)
    if (data.status !== '1' || !data.pois?.length) return []
    return data.pois
      .filter((p: { location: string }) => p.location)
      .map(
        (p: {
          name: string
          address: string
          pname?: string
          cityname?: string
          adname?: string
          location: string
        }) => {
          const [lng, lat] = p.location.split(',').map(Number)
          const address = [p.pname, p.cityname, p.adname, p.address].filter(Boolean).join('')
          return { name: p.name, district: [p.cityname, p.adname].filter(Boolean).join(''), address: address || p.name, lat, lng, source: 'place' }
        },
      )
  } catch (e) {
    console.warn('[高德] place/text 网络错误', e)
    return []
  }
}

export interface AmapRouteResult {
  durationMin: number
  distanceKm: number
  path: [number, number][]
  summary?: string
}

function decodePolyline(steps: { polyline?: string }[]): [number, number][] {
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
  try {
    const origin = `${from.lng},${from.lat}`
    const destination = `${to.lng},${to.lat}`
    const url = `https://restapi.amap.com/v3/direction/driving?origin=${origin}&destination=${destination}&extensions=all&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    warnAmap('driving', data)
    const path0 = data.route?.paths?.[0]
    if (data.status !== '1' || !path0) return null
    return {
      durationMin: Math.round(Number(path0.duration) / 60),
      distanceKm: Math.round((Number(path0.distance) / 1000) * 10) / 10,
      path: decodePolyline(path0.steps || []),
      summary: `驾车约 ${Math.round(Number(path0.duration) / 60)} 分钟`,
    }
  } catch (e) {
    console.warn('[高德] driving 网络错误', e)
    return null
  }
}

export async function amapTransit(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<AmapRouteResult | null> {
  const key = getAmapKey()
  if (!key) return null
  try {
    const origin = `${from.lng},${from.lat}`
    const destination = `${to.lng},${to.lat}`
    const url = `https://restapi.amap.com/v3/direction/transit/integrated?origin=${origin}&destination=${destination}&city=北京&cityd=北京&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    warnAmap('transit', data)
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

    const distanceRaw = Number(trans.distance || data.route?.distance || 0)
    return {
      durationMin: Math.round(Number(trans.duration) / 60),
      distanceKm: Math.round((distanceRaw / 1000) * 10) / 10,
      path,
      summary: names.length ? names.slice(0, 4).join(' → ') : '公共交通',
    }
  } catch (e) {
    console.warn('[高德] transit 网络错误', e)
    return null
  }
}

/** 高德步行路径（短距离补充） */
export async function amapWalking(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<AmapRouteResult | null> {
  const key = getAmapKey()
  if (!key) return null
  try {
    const origin = `${from.lng},${from.lat}`
    const destination = `${to.lng},${to.lat}`
    const url = `https://restapi.amap.com/v3/direction/walking?origin=${origin}&destination=${destination}&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    warnAmap('walking', data)
    const path0 = data.route?.paths?.[0]
    if (data.status !== '1' || !path0) return null
    return {
      durationMin: Math.round(Number(path0.duration) / 60),
      distanceKm: Math.round((Number(path0.distance) / 1000) * 10) / 10,
      path: decodePolyline(path0.steps || []),
      summary: `步行约 ${Math.round(Number(path0.duration) / 60)} 分钟`,
    }
  } catch (e) {
    console.warn('[高德] walking 网络错误', e)
    return null
  }
}

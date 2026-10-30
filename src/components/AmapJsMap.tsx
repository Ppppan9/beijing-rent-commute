import { useEffect, useRef, useState } from 'react'
import type { CompanyLocation, CommuteInfo, RentalListing } from '../types'
import { loadAmapJs, type AMapMap, type AMapNamespace } from '../services/amapJsLoader'

interface Props {
  company: CompanyLocation | null
  listings: RentalListing[]
  commuteMap: Record<string, CommuteInfo | null>
  ranks: Record<string, number>
  selectedId: string | null
  pinMode: 'company' | 'rental' | null
  preferredMode: 'transit' | 'driving'
  onMapPick: (lat: number, lng: number) => void
  onSelectListing: (id: string) => void
}

function companyContent() {
  return `<div class="amap-pin company"><span>司</span></div>`
}

function rentalContent(color: string, rank?: number) {
  return `<div class="amap-pin rental" style="--pin:${color}"><span>${rank ?? '房'}</span></div>`
}

/** 官方高德 JS API 矢量底图（VITE_AMAP_JS_KEY + securityJsCode） */
export default function AmapJsMap({
  company,
  listings,
  commuteMap,
  ranks,
  selectedId,
  pinMode,
  preferredMode,
  onMapPick,
  onSelectListing,
}: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapMap | null>(null)
  const AMapRef = useRef<AMapNamespace | null>(null)
  const clickFn = useRef<((e: { lnglat: { getLng: () => number; getLat: () => number } }) => void) | undefined>(
    undefined,
  )
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const AMap = await loadAmapJs()
        if (cancelled || !box.current) return
        AMapRef.current = AMap
        const map = new AMap.Map(box.current, {
          zoom: 11,
          center: [116.4074, 39.9042],
          viewMode: '2D',
          mapStyle: 'amap://styles/whitesmoke',
          showLabel: true,
        })
        mapRef.current = map
        setReady(true)
        setError(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '高德 JS 底图加载失败'
        console.warn('[高德 JS]', msg, e)
        if (!cancelled) setError(msg)
      }
    })()
    return () => {
      cancelled = true
      mapRef.current?.destroy()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // Click to pin
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (clickFn.current) map.off('click', clickFn.current as never)
    if (!pinMode) return
    const fn = (e: { lnglat: { getLng: () => number; getLat: () => number } }) => {
      onMapPick(e.lnglat.getLat(), e.lnglat.getLng())
    }
    clickFn.current = fn
    map.on('click', fn)
    return () => {
      map.off('click', fn as never)
    }
  }, [pinMode, onMapPick, ready])

  // Markers + route polylines
  useEffect(() => {
    const map = mapRef.current
    const AMap = AMapRef.current
    if (!map || !AMap || !ready) return

    map.clearMap()
    const overlays: unknown[] = []

    if (company) {
      const m = new AMap.Marker({
        position: [company.position.lng, company.position.lat],
        title: company.name,
        content: companyContent(),
        offset: new AMap.Pixel(-18, -40),
        zIndex: 120,
      })
      map.add(m)
      overlays.push(m)
    }

    for (const l of listings) {
      const m = new AMap.Marker({
        position: [l.position.lng, l.position.lat],
        title: l.name,
        content: rentalContent(l.color, ranks[l.id]),
        offset: new AMap.Pixel(-16, -38),
        zIndex: selectedId === l.id ? 130 : 100,
      })
      m.on('click', () => onSelectListing(l.id))
      map.add(m)
      overlays.push(m)

      const info = commuteMap[l.id]
      const route =
        preferredMode === 'driving'
          ? info?.driving || info?.transit
          : info?.transit || info?.driving
      if (route?.path?.length) {
        const path = route.path.map(([lat, lng]) => [lng, lat])
        const line = new AMap.Polyline({
          path,
          strokeColor: '#ffffff',
          strokeWeight: selectedId === l.id ? 10 : 7,
          strokeOpacity: selectedId && selectedId !== l.id ? 0.15 : 0.9,
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: 50,
        })
        map.add(line)
        overlays.push(line)
        const line2 = new AMap.Polyline({
          path,
          strokeColor: l.color,
          strokeWeight: selectedId === l.id ? 5 : 3.5,
          strokeOpacity: selectedId && selectedId !== l.id ? 0.2 : 0.9,
          strokeStyle: route.mode === 'transit' ? 'dashed' : 'solid',
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: 51,
        })
        line2.on('click', () => onSelectListing(l.id))
        map.add(line2)
        overlays.push(line2)
      }
    }

    if (overlays.length) {
      map.setFitView(overlays, false, [72, 72, 72, 72])
    }
  }, [company, listings, commuteMap, ranks, selectedId, preferredMode, onSelectListing, ready])

  return (
    <div className={`map-wrap amap-js ${pinMode ? 'pin-mode' : ''}`}>
      {pinMode && (
        <div className="pin-banner">
          点击地图放置{pinMode === 'company' ? '公司' : '房源'}位置
        </div>
      )}
      {!ready && !error && <div className="amap-loading">正在加载高德矢量地图…</div>}
      {error && (
        <div className="amap-loading error">
          高德 JS 地图加载失败：{error}
          <br />
          请确认 Key 为「Web端(JS API)」，安全密钥正确，且域名白名单含 ppppan9.github.io
        </div>
      )}
      <div ref={box} className="map-root amap-js-root" />
      <div className="basemap-switch">
        <button type="button" className="active">
          高德矢量 JS
        </button>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
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

/** 官方高德 JS API 矢量底图（需 VITE_AMAP_JS_KEY） */
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
  const clickFn = useRef<((e: { lnglat: { getLng: () => number; getLat: () => number } }) => void) | undefined>(undefined)

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
        })
        mapRef.current = map
      } catch (e) {
        console.warn('[高德 JS] 底图加载失败，请检查 VITE_AMAP_JS_KEY / 安全密钥', e)
      }
    })()
    return () => {
      cancelled = true
      mapRef.current?.destroy()
      mapRef.current = null
    }
  }, [])

  // Click to pin
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
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
  }, [pinMode, onMapPick])

  // Markers + routes
  useEffect(() => {
    const map = mapRef.current
    const AMap = AMapRef.current
    if (!map || !AMap) return

    map.clearMap()
    const overlays: unknown[] = []

    if (company) {
      const m = new AMap.Marker({
        position: [company.position.lng, company.position.lat],
        title: company.name,
        label: { content: '公司', direction: 'bottom' },
      })
      map.add(m)
      overlays.push(m)
    }

    for (const l of listings) {
      const m = new AMap.Marker({
        position: [l.position.lng, l.position.lat],
        title: l.name,
        label: {
          content: `#${ranks[l.id] ?? ''}`,
          direction: 'top',
        },
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
          strokeColor: l.color,
          strokeWeight: selectedId === l.id ? 6 : 4,
          strokeOpacity: selectedId && selectedId !== l.id ? 0.25 : 0.85,
          strokeStyle: route.mode === 'transit' ? 'dashed' : 'solid',
        })
        line.on('click', () => onSelectListing(l.id))
        map.add(line)
        overlays.push(line)
      }
    }

    if (overlays.length) {
      map.setFitView(overlays, false, [60, 60, 60, 60])
    }
  }, [company, listings, commuteMap, ranks, selectedId, preferredMode, onSelectListing])

  return (
    <div className={`map-wrap amap-js ${pinMode ? 'pin-mode' : ''}`}>
      {pinMode && (
        <div className="pin-banner">
          点击地图放置{pinMode === 'company' ? '公司' : '房源'}位置
        </div>
      )}
      <div ref={box} className="map-root amap-js-root" />
      <div className="basemap-switch">
        <button type="button" className="active">
          高德矢量
        </button>
      </div>
    </div>
  )
}

import AmapJsMap from './AmapJsMap'
import { canUseAmapJsMap } from '../services/amapJsLoader'
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import type { CompanyLocation, CommuteInfo, RentalListing } from '../types'

type BasemapId = 'normal' | 'satellite'

const AMAP_ATTR = '&copy; <a href="https://lbs.amap.com/">高德地图</a>'

/**
 * 高德底图（GCJ-02）。
 * HiDPI：wprd 的 scl=2 返回同级 512×512 瓦片，在 Leaflet tileSize=256 下于 Retina 屏清晰；
 * 勿再叠加 detectRetina，否则会重复放大请求。
 */
function amapNormalUrl(scl: 1 | 2) {
  return `https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=${scl}&style=7`
}

function amapSatelliteUrl() {
  return 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
}

function amapRoadOverlayUrl() {
  return 'https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}'
}

function useAmapTileScale(): 1 | 2 {
  const [scl, setScl] = useState<1 | 2>(() =>
    typeof window !== 'undefined' && (window.devicePixelRatio || 1) >= 1.5 ? 2 : 1,
  )
  useEffect(() => {
    const sync = () => setScl((window.devicePixelRatio || 1) >= 1.5 ? 2 : 1)
    sync()
    window.addEventListener('resize', sync)
    // DPR 变化（外接屏等）
    const mq = window.matchMedia(`(resolution: 2dppx)`)
    const onMq = () => sync()
    mq.addEventListener?.('change', onMq)
    return () => {
      window.removeEventListener('resize', sync)
      mq.removeEventListener?.('change', onMq)
    }
  }, [])
  return scl
}

function companyIcon() {
  return L.divIcon({
    className: 'map-marker-wrap',
    html: `
      <div class="map-marker company-marker">
        <span class="map-marker-pulse"></span>
        <span class="map-marker-core">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>
        </span>
        <span class="map-marker-label">公司</span>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 48],
    popupAnchor: [0, -44],
  })
}

function rentalIcon(color: string, rank?: number, selected?: boolean) {
  const label = rank != null ? String(rank) : '房'
  return L.divIcon({
    className: `map-marker-wrap ${selected ? 'is-selected' : ''}`,
    html: `
      <div class="map-marker rental-marker ${selected ? 'is-selected' : ''}" style="--pin:${color}">
        <span class="map-marker-core">${label}</span>
        <span class="map-marker-stem"></span>
        <span class="map-marker-shadow"></span>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 48],
    popupAnchor: [0, -42],
  })
}

function FitBounds({
  company,
  listings,
}: {
  company: CompanyLocation | null
  listings: RentalListing[]
}) {
  const map = useMap()
  useEffect(() => {
    const pts: [number, number][] = []
    if (company) pts.push([company.position.lat, company.position.lng])
    listings.forEach((l) => pts.push([l.position.lat, l.position.lng]))
    if (pts.length === 0) {
      map.setView([39.9042, 116.4074], 11)
      return
    }
    if (pts.length === 1) {
      map.setView(pts[0], 13)
      return
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [56, 56], maxZoom: 14 })
  }, [company, listings, map])
  return null
}

function ClickHandler({
  enabled,
  onPick,
}: {
  enabled: boolean
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Soften Leaflet chrome to match modern basemap */
function MapChrome() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    el.classList.add('map-modern')
    return () => {
      el.classList.remove('map-modern')
    }
  }, [map])
  return null
}

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

export default function MapView(props: Props) {
  if (canUseAmapJsMap()) {
    return <AmapJsMap {...props} />
  }
  return <LeafletGaodeMap {...props} />
}

function LeafletGaodeMap({
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
  const [basemap, setBasemap] = useState<BasemapId>(() => {
    try {
      const saved = localStorage.getItem('bj-rent-basemap')
      if (saved === 'normal' || saved === 'satellite') return saved
      // migrate away from retired Carto styles
      if (saved === 'voyager' || saved === 'positron') return 'normal'
    } catch {
      /* ignore */
    }
    return 'normal'
  })

  const center = useMemo<[number, number]>(
    () =>
      company
        ? [company.position.lat, company.position.lng]
        : [39.9042, 116.4074],
    [company],
  )

  const tileScale = useAmapTileScale()

  const setBasemapPersist = (id: BasemapId) => {
    setBasemap(id)
    try {
      localStorage.setItem('bj-rent-basemap', id)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`map-wrap ${pinMode ? 'pin-mode' : ''}`}>
      {pinMode && (
        <div className="pin-banner">
          点击地图放置{pinMode === 'company' ? '公司' : '房源'}位置
        </div>
      )}

      <div className="basemap-switch" role="group" aria-label="底图样式">
        <button
          type="button"
          className={basemap === 'normal' ? 'active' : ''}
          onClick={() => setBasemapPersist('normal')}
        >
          高德标准
        </button>
        <button
          type="button"
          className={basemap === 'satellite' ? 'active' : ''}
          onClick={() => setBasemapPersist('satellite')}
        >
          高德影像
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={11}
        className="map-root"
        scrollWheelZoom
        zoomControl={false}
      >
        {basemap === 'normal' ? (
          <TileLayer
            key={`amap-normal-${tileScale}`}
            attribution={AMAP_ATTR}
            url={amapNormalUrl(tileScale)}
            maxZoom={18}
            maxNativeZoom={18}
            tileSize={256}
            zoomOffset={0}
            detectRetina={false}
            subdomains="1234"
            updateWhenIdle
            keepBuffer={2}
          />
        ) : (
          <>
            <TileLayer
              key="amap-sat"
              attribution={AMAP_ATTR}
              url={amapSatelliteUrl()}
              maxZoom={18}
              maxNativeZoom={18}
              tileSize={256}
              detectRetina
              zoomOffset={0}
              subdomains="1234"
              updateWhenIdle
              keepBuffer={2}
            />
            <TileLayer
              key="amap-road-overlay"
              url={amapRoadOverlayUrl()}
              maxZoom={18}
              maxNativeZoom={18}
              tileSize={256}
              detectRetina
              subdomains="1234"
              opacity={0.95}
              attribution=""
            />
          </>
        )}
        <ZoomControlModern />
        <MapChrome />
        <FitBounds company={company} listings={listings} />
        <ClickHandler enabled={!!pinMode} onPick={onMapPick} />

        {company &&
          listings.map((l) => {
            const info = commuteMap[l.id]
            if (!info) return null
            const route =
              preferredMode === 'driving'
                ? info.driving || info.transit
                : info.transit || info.driving
            if (!route?.path?.length) return null
            const active = selectedId === l.id
            const dimmed = !!selectedId && !active
            const isTransit = route.mode === 'transit'
            return (
              <Fragment key={`route-group-${l.id}-${preferredMode}`}>
                <Polyline
                  positions={route.path}
                  pathOptions={{
                    color: '#ffffff',
                    weight: active ? 10 : 7,
                    opacity: dimmed ? 0.15 : active ? 0.95 : 0.7,
                    lineCap: 'round',
                    lineJoin: 'round',
                    interactive: false,
                  }}
                />
                <Polyline
                  positions={route.path}
                  pathOptions={{
                    color: l.color,
                    weight: active ? 5 : 3.5,
                    opacity: dimmed ? 0.2 : active ? 0.95 : 0.75,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: isTransit ? '10 8' : undefined,
                  }}
                  eventHandlers={{ click: () => onSelectListing(l.id) }}
                />
              </Fragment>
            )
          })}

        {company && (
          <Marker position={[company.position.lat, company.position.lng]} icon={companyIcon()} zIndexOffset={600}>
            <Popup className="modern-popup">
              <div className="popup-card">
                <div className="popup-kicker">公司</div>
                <strong>{company.name}</strong>
                <p>{company.address}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {listings.map((l) => {
          const selected = selectedId === l.id
          return (
            <Marker
              key={l.id}
              position={[l.position.lat, l.position.lng]}
              icon={rentalIcon(l.color, ranks[l.id], selected)}
              zIndexOffset={selected ? 500 : 200}
              eventHandlers={{ click: () => onSelectListing(l.id) }}
            >
              <Popup className="modern-popup">
                <div className="popup-card">
                  <div className="popup-kicker" style={{ color: l.color }}>
                    推荐 #{ranks[l.id] ?? '-'}
                  </div>
                  <strong>{l.name}</strong>
                  <p>{l.address}</p>
                  <div className="popup-meta">月租 ¥{l.monthlyRent.toLocaleString('zh-CN')}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

function ZoomControlModern() {
  const map = useMap()
  useEffect(() => {
    const ctrl = L.control.zoom({ position: 'bottomright' })
    ctrl.addTo(map)
    return () => {
      ctrl.remove()
    }
  }, [map])
  return null
}

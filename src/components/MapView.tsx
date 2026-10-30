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

type BasemapId = 'voyager' | 'positron'

const BASEMAPS: Record<
  BasemapId,
  { name: string; url: string; attribution: string; maxZoom: number }
> = {
  voyager: {
    name: 'Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  positron: {
    name: 'Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
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

export default function MapView({
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
      const saved = localStorage.getItem('bj-rent-basemap') as BasemapId | null
      if (saved === 'voyager' || saved === 'positron') return saved
    } catch {
      /* ignore */
    }
    return 'voyager'
  })

  const center = useMemo<[number, number]>(
    () =>
      company
        ? [company.position.lat, company.position.lng]
        : [39.9042, 116.4074],
    [company],
  )

  const tile = BASEMAPS[basemap]

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
          className={basemap === 'voyager' ? 'active' : ''}
          onClick={() => setBasemapPersist('voyager')}
        >
          Voyager
        </button>
        <button
          type="button"
          className={basemap === 'positron' ? 'active' : ''}
          onClick={() => setBasemapPersist('positron')}
        >
          Positron
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={11}
        className="map-root"
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          key={basemap}
          attribution={tile.attribution}
          url={tile.url}
          maxZoom={tile.maxZoom}
          subdomains="abcd"
        />
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

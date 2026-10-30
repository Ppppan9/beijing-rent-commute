import { useEffect, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import type { CompanyLocation, CommuteInfo, RentalListing } from '../types'

// Fix default marker icons under Vite/bundlers
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function companyIcon() {
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background:#2563eb;color:#fff;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:14px;font-weight:700">司</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  })
}

function rentalIcon(color: string, rank?: number) {
  const label = rank != null ? String(rank) : '房'
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:12px;font-weight:700">${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -26],
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
    map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 14 })
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
  const center = useMemo<[number, number]>(
    () =>
      company
        ? [company.position.lat, company.position.lng]
        : [39.9042, 116.4074],
    [company],
  )

  return (
    <div className={`map-wrap ${pinMode ? 'pin-mode' : ''}`}>
      {pinMode && (
        <div className="pin-banner">
          点击地图放置{pinMode === 'company' ? '公司' : '房源'}位置（可拖动微调请重新点选）
        </div>
      )}
      <MapContainer center={center} zoom={11} className="map-root" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds company={company} listings={listings} />
        <ClickHandler enabled={!!pinMode} onPick={onMapPick} />

        {company && (
          <Marker position={[company.position.lat, company.position.lng]} icon={companyIcon()}>
            <Popup>
              <strong>公司：{company.name}</strong>
              <br />
              {company.address}
            </Popup>
          </Marker>
        )}

        {listings.map((l) => (
          <Marker
            key={l.id}
            position={[l.position.lat, l.position.lng]}
            icon={rentalIcon(l.color, ranks[l.id])}
            eventHandlers={{ click: () => onSelectListing(l.id) }}
          >
            <Popup>
              <strong>
                #{ranks[l.id] ?? '-'} {l.name}
              </strong>
              <br />
              {l.address}
              <br />
              月租 ¥{l.monthlyRent}
            </Popup>
          </Marker>
        ))}

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
            return (
              <Polyline
                key={`route-${l.id}-${preferredMode}`}
                positions={route.path}
                pathOptions={{
                  color: l.color,
                  weight: active ? 5 : 3,
                  opacity: active ? 0.9 : selectedId ? 0.25 : 0.65,
                  dashArray: route.mode === 'transit' ? '8 6' : undefined,
                }}
                eventHandlers={{ click: () => onSelectListing(l.id) }}
              />
            )
          })}

        {pinMode && (
          <CircleMarker
            center={center}
            radius={0}
            pathOptions={{ opacity: 0 }}
          />
        )}
      </MapContainer>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { searchPlaces } from '../services/routing'
import type { GeoResult } from '../services/amap'
import { BEIJING_LANDMARKS } from '../types'

interface Props {
  placeholder?: string
  onSelect: (r: GeoResult) => void
  onPickOnMap?: () => void
}

export default function SearchBox({ placeholder = '搜索北京小区 / 地址…', onSelect, onPickOnMap }: Props) {
  const [searched, setSearched] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<number | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const runSearch = (text: string) => {
    if (timer.current) window.clearTimeout(timer.current)
    if (!text.trim()) {
      setResults([])
      return
    }
    timer.current = window.setTimeout(async () => {
      setLoading(true)
      try {
        const list = await searchPlaces(text.trim())
        setResults(list)
        setSearched(true)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  return (
    <div className="search-box" ref={wrap}>
      <div className="search-input-row">
        <Search size={16} className="search-icon" />
        <input
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value)
            runSearch(e.target.value)
          }}
          onFocus={() => {
            if (results.length) setOpen(true)
            else if (!q) {
              setResults(
                BEIJING_LANDMARKS.slice(0, 6).map((l) => ({
                  name: l.name,
                  address: l.address,
                  lat: l.position.lat,
                  lng: l.position.lng,
                })),
              )
              setOpen(true)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              onSelect(results[0])
              setQ(results[0].name)
              setOpen(false)
            }
          }}
        />
        {loading && <Loader2 size={16} className="spin" />}
      </div>
      {open && (results.length > 0 || searched) && (
        <ul className="search-dropdown">
          {results.length === 0 && <li className="empty">没有找到，换个关键词（如去掉“小区”）</li>}
          {results.map((r, i) => (
            <li
              key={`${r.lat}-${r.lng}-${i}`}
              onClick={() => {
                onSelect(r)
                setQ(r.name)
                setOpen(false)
              }}
            >
              <MapPin size={14} />
              <div>
                <div className="name">{r.name}</div>
                <div className="addr">
                  {r.district && <b className="district">{r.district}</b>} {r.address}
                </div>
              </div>
            </li>
          ))}
          {onPickOnMap && (
            <li
              className="map-fallback"
              onClick={() => {
                setOpen(false)
                onPickOnMap()
              }}
            >
              <MapPin size={14} /> 搜不到？在地图上点选
            </li>
          )}
        </ul>
      )}
      {onPickOnMap && (
        <button type="button" className="map-fallback-link" onClick={onPickOnMap}>
          搜不到？在地图上点选
        </button>
      )}
    </div>
  )
}

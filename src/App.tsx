import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapPin, Sparkles, Filter } from 'lucide-react'
import MapView from './components/MapView'
import CompanyPanel from './components/CompanyPanel'
import RentalForm from './components/RentalForm'
import ListingCard from './components/ListingCard'
import CompareTable from './components/CompareTable'
import SettingsBar from './components/SettingsBar'
import type {
  AppSettings,
  CompanyLocation,
  CommuteInfo,
  RentalListing,
} from './types'
import { hasAmapKey } from './services/amap'
import { fetchCommute } from './services/routing'
import { scoreListings } from './utils/score'
import { exportJson, importJson, loadState, saveState } from './utils/storage'
import 'leaflet/dist/leaflet.css'
import './App.css'

type SortKey = 'score' | 'commute' | 'cost' | 'rent'
type PinMode = 'company' | 'rental' | null

export default function App() {
  const initial = loadState()
  const [company, setCompany] = useState<CompanyLocation | null>(initial.company)
  const [listings, setListings] = useState<RentalListing[]>(initial.listings)
  const [settings, setSettings] = useState<AppSettings>(initial.settings)
  const [commuteMap, setCommuteMap] = useState<Record<string, CommuteInfo | null>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pinMode, setPinMode] = useState<PinMode>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RentalListing | null>(null)
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [maxCommute, setMaxCommute] = useState<number>(120)
  const [maxRent, setMaxRent] = useState<number>(20000)
  const [mobileTab, setMobileTab] = useState<'list' | 'map' | 'compare'>('list')

  const demoMode = !hasAmapKey()

  // Persist
  useEffect(() => {
    saveState({ company, listings, settings, version: 1 })
  }, [company, listings, settings])

  // Fetch commute when company or listings change
  useEffect(() => {
    if (!company || listings.length === 0) {
      setCommuteMap({})
      return
    }
    let cancelled = false
    const run = async () => {
      const next: Record<string, CommuteInfo | null> = { ...commuteMap }
      await Promise.all(
        listings.map(async (l) => {
          // skip if already have for same endpoints roughly — always refresh for simplicity when list/company changes
          try {
            next[l.id] = await fetchCommute(l.position, company.position)
          } catch {
            next[l.id] = null
          }
        }),
      )
      if (!cancelled) setCommuteMap({ ...next })
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.position.lat, company?.position.lng, listings.map((l) => l.id + l.position.lat).join('|')])

  const scored = useMemo(
    () => scoreListings(listings, commuteMap, settings),
    [listings, commuteMap, settings],
  )

  const filtered = useMemo(() => {
    let list = scored.filter((s) => {
      const route =
        settings.preferredMode === 'driving'
          ? s.commute?.driving || s.commute?.transit
          : s.commute?.transit || s.commute?.driving
      const dur = route?.durationMin ?? 0
      if (dur > maxCommute) return false
      if (s.listing.monthlyRent > maxRent) return false
      return true
    })
    if (sortKey === 'score') list = [...list].sort((a, b) => a.rank - b.rank)
    if (sortKey === 'commute') {
      list = [...list].sort((a, b) => {
        const da =
          (settings.preferredMode === 'driving'
            ? a.commute?.driving?.durationMin
            : a.commute?.transit?.durationMin) ?? 999
        const db =
          (settings.preferredMode === 'driving'
            ? b.commute?.driving?.durationMin
            : b.commute?.transit?.durationMin) ?? 999
        return da - db
      })
    }
    if (sortKey === 'cost') {
      list = [...list].sort((a, b) => a.cost.effectiveMonthly - b.cost.effectiveMonthly)
    }
    if (sortKey === 'rent') {
      list = [...list].sort((a, b) => a.listing.monthlyRent - b.listing.monthlyRent)
    }
    return list
  }, [scored, sortKey, maxCommute, maxRent, settings.preferredMode])

  const ranks = useMemo(() => {
    const m: Record<string, number> = {}
    scored.forEach((s) => {
      m[s.listing.id] = s.rank
    })
    return m
  }, [scored])

  const onMapPick = useCallback(
    (lat: number, lng: number) => {
      if (pinMode === 'company') {
        setCompany({
          name: company?.name || '公司选点',
          address: company?.address || `地图选点 ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          position: { lat, lng },
        })
        setPinMode(null)
      } else if (pinMode === 'rental') {
        setPendingPin({ lat, lng })
        setFormOpen(true)
        setPinMode(null)
      }
    },
    [pinMode, company],
  )

  const handleExport = () => {
    const blob = new Blob(
      [exportJson({ company, listings, settings, version: 1 })],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `beijing-rent-commute-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const state = importJson(text)
      setCompany(state.company)
      setListings(state.listings)
      setSettings(state.settings)
      setCommuteMap({})
      alert(`已导入 ${state.listings.length} 套房源`)
    } catch (e) {
      alert(`导入失败：${e instanceof Error ? e.message : '未知错误'}`)
    }
  }

  const loadDemo = () => {
    setCompany({
      name: '国贸 CBD',
      address: '北京市朝阳区建国门外大街1号',
      position: { lat: 39.9087, lng: 116.4604 },
    })
    setListings([
      {
        id: 'demo-1',
        name: '望京西园',
        address: '北京市朝阳区望京西园',
        position: { lat: 39.9945, lng: 116.4702 },
        monthlyRent: 6800,
        sizeSqm: 55,
        depositMonths: 1,
        agencyFee: 6800,
        otherMonthly: 200,
        workdaysPerMonth: 22,
        notes: '靠近地铁 14/15 号线',
        createdAt: Date.now(),
        color: '#e74c3c',
      },
      {
        id: 'demo-2',
        name: '双井富力城',
        address: '北京市朝阳区双井',
        position: { lat: 39.893, lng: 116.466 },
        monthlyRent: 8500,
        sizeSqm: 68,
        depositMonths: 2,
        agencyFee: 0,
        otherMonthly: 350,
        workdaysPerMonth: 22,
        notes: '通勤近，租金偏高',
        createdAt: Date.now(),
        color: '#3498db',
      },
      {
        id: 'demo-3',
        name: '回龙观龙腾苑',
        address: '北京市昌平区回龙观',
        position: { lat: 40.0705, lng: 116.336 },
        monthlyRent: 4500,
        sizeSqm: 70,
        depositMonths: 1,
        agencyFee: 2250,
        otherMonthly: 150,
        workdaysPerMonth: 22,
        notes: '面积大、通勤较长',
        createdAt: Date.now(),
        color: '#2ecc71',
      },
      {
        id: 'demo-4',
        name: '通州北苑',
        address: '北京市通州区北苑',
        position: { lat: 39.908, lng: 116.646 },
        monthlyRent: 3800,
        sizeSqm: 60,
        depositMonths: 1,
        agencyFee: 3800,
        otherMonthly: 100,
        workdaysPerMonth: 22,
        notes: '租金低，需留意地铁时长',
        createdAt: Date.now(),
        color: '#9b59b6',
      },
    ])
    setCommuteMap({})
    setSelectedId('demo-2')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <MapPin size={22} />
          <div>
            <h1>北京租房通勤对比</h1>
            <p>地图路线 · 成本核算 · 性价比推荐</p>
          </div>
        </div>
        <div className="header-actions">
          {listings.length === 0 && (
            <button type="button" className="btn btn-primary" onClick={loadDemo}>
              <Sparkles size={14} /> 加载示例数据
            </button>
          )}
        </div>
      </header>

      <nav className="mobile-tabs">
        <button
          type="button"
          className={mobileTab === 'list' ? 'active' : ''}
          onClick={() => setMobileTab('list')}
        >
          列表
        </button>
        <button
          type="button"
          className={mobileTab === 'map' ? 'active' : ''}
          onClick={() => setMobileTab('map')}
        >
          地图
        </button>
        <button
          type="button"
          className={mobileTab === 'compare' ? 'active' : ''}
          onClick={() => setMobileTab('compare')}
        >
          对比
        </button>
      </nav>

      <div className="app-body">
        <aside className={`sidebar ${mobileTab === 'list' ? 'show' : ''}`}>
          <CompanyPanel
            company={company}
            pinActive={pinMode === 'company'}
            onSetCompany={(c) => {
              setCompany(c)
              setPinMode(null)
            }}
            onTogglePin={() => setPinMode((m) => (m === 'company' ? null : 'company'))}
            onClear={() => setCompany(null)}
          />

          <RentalForm
            open={formOpen}
            onOpen={() => {
              setEditing(null)
              setPendingPin(null)
              setFormOpen(true)
            }}
            editing={editing}
            pinActive={pinMode === 'rental'}
            pendingPin={pendingPin}
            existingCount={listings.length}
            onTogglePin={() => setPinMode((m) => (m === 'rental' ? null : 'rental'))}
            onSave={(listing) => {
              setListings((prev) => {
                const idx = prev.findIndex((x) => x.id === listing.id)
                if (idx >= 0) {
                  const copy = [...prev]
                  copy[idx] = listing
                  return copy
                }
                return [...prev, listing]
              })
              setFormOpen(false)
              setEditing(null)
              setPendingPin(null)
              setSelectedId(listing.id)
            }}
            onCancel={() => {
              setFormOpen(false)
              setEditing(null)
              setPendingPin(null)
              setPinMode((m) => (m === 'rental' ? null : m))
            }}
          />

          <section className="panel">
            <div className="panel-title">
              <Filter size={18} />
              <h2>排序筛选</h2>
            </div>
            <div className="form-2col">
              <label>
                排序
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                  <option value="score">推荐分</option>
                  <option value="commute">通勤时长</option>
                  <option value="cost">有效月成本</option>
                  <option value="rent">月租金</option>
                </select>
              </label>
              <label>
                最长通勤 (分)
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={maxCommute}
                  onChange={(e) => setMaxCommute(Number(e.target.value) || 120)}
                />
              </label>
            </div>
            <label>
              最高月租 (¥)
              <input
                type="number"
                min={500}
                step={100}
                value={maxRent}
                onChange={(e) => setMaxRent(Number(e.target.value) || 20000)}
              />
            </label>
          </section>

          <div className="listing-list">
            {!company && listings.length > 0 && (
              <p className="hint warn">请先设置公司位置，才能计算通勤与推荐分。</p>
            )}
            {filtered.map((item) => (
              <ListingCard
                key={item.listing.id}
                item={item}
                selected={selectedId === item.listing.id}
                preferredMode={settings.preferredMode}
                onSelect={() => {
                  setSelectedId(item.listing.id)
                  setMobileTab('map')
                }}
                onEdit={() => {
                  setEditing(item.listing)
                  setFormOpen(true)
                }}
                onDelete={() => {
                  if (confirm(`删除「${item.listing.name}」？`)) {
                    setListings((prev) => prev.filter((x) => x.id !== item.listing.id))
                    setCommuteMap((m) => {
                      const n = { ...m }
                      delete n[item.listing.id]
                      return n
                    })
                  }
                }}
              />
            ))}
            {listings.length === 0 && (
              <p className="hint">还没有收藏房源。搜索地址、地图选点，或加载示例数据开始对比。</p>
            )}
          </div>

          <SettingsBar
            settings={settings}
            demoMode={demoMode}
            onChange={setSettings}
            onExport={handleExport}
            onImport={handleImport}
          />
        </aside>

        <main className={`main-map ${mobileTab === 'map' ? 'show' : ''}`}>
          <MapView
            company={company}
            listings={listings}
            commuteMap={commuteMap}
            ranks={ranks}
            selectedId={selectedId}
            pinMode={pinMode}
            preferredMode={settings.preferredMode}
            onMapPick={onMapPick}
            onSelectListing={setSelectedId}
          />
        </main>
      </div>

      <div className={`compare-dock ${mobileTab === 'compare' ? 'show' : ''}`}>
        <CompareTable items={filtered} preferredMode={settings.preferredMode} />
      </div>

      <footer className="app-footer">
        <span>开源 MIT · 数据仅存于本机浏览器 localStorage</span>
        <span>
          {demoMode ? '演示模式（高德底图）' : '高德地图 + 路线'} · 推荐分相对当前收藏集归一化
        </span>
      </footer>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MapPin,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Table2,
  Settings2,
  Bus,
  Car,
  ChevronUp,
  Download,
} from 'lucide-react'
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
import { canUseAmapJsMap } from './services/amapJsLoader'
import { fetchCommute } from './services/routing'
import { scoreListings } from './utils/score'
import {
  downloadExport,
  importJson,
  loadState,
  markReminded,
  resetAllData,
  saveState,
  shouldRemindBackup,
  STORAGE_KEY,
} from './utils/storage'
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [compareOpen, setCompareOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sheetExpanded, setSheetExpanded] = useState(false)

  const demoMode = !hasAmapKey()

  useEffect(() => {
    saveState({ company, listings, settings, version: 1 })
  }, [company, listings, settings])

  useEffect(() => {
    if (!company || listings.length === 0) {
      setCommuteMap({})
      return
    }
    let cancelled = false
    const run = async () => {
      const next: Record<string, CommuteInfo | null> = {}
      await Promise.all(
        listings.map(async (l) => {
          try {
            next[l.id] = await fetchCommute(l.position, company.position)
          } catch {
            next[l.id] = null
          }
        }),
      )
      if (!cancelled) setCommuteMap(next)
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

  const [showBackupTip, setShowBackupTip] = useState(() => shouldRemindBackup(initial.listings.length))

  const handleExport = () => {
    downloadExport({ company, listings, settings, version: 1 })
    setShowBackupTip(false)
  }

  const handleResetData = () => {
    const n = listings.length
    if (
      !confirm(
        `确定清空本地全部数据？\n当前有 ${n} 套房源。\n清空前会在本机留下一份备份键，但建议先点「导出备份」。`,
      )
    ) {
      return
    }
    if (!confirm('再次确认：真的要清空吗？此操作需你主动触发，网站更新不会自动清空。')) return
    resetAllData(true)
    setCompany(null)
    setListings([])
    setCommuteMap({})
    setSelectedId(null)
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
    setSidebarOpen(true)
  }

  const openAdd = () => {
    setEditing(null)
    setPendingPin(null)
    setFormOpen(true)
    setSidebarOpen(true)
  }

  const panelBody = (
    <>
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

      <div className="compact-block">
        <button type="button" className="btn btn-primary btn-block btn-sm" onClick={openAdd}>
          <Plus size={14} /> 添加房源
        </button>
      </div>

      <div className="compact-block filters-row">
        <label>
          排序
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="score">推荐分</option>
            <option value="commute">通勤</option>
            <option value="cost">有效成本</option>
            <option value="rent">月租</option>
          </select>
        </label>
        <label>
          ≤通勤分
          <input
            type="number"
            min={10}
            max={180}
            value={maxCommute}
            onChange={(e) => setMaxCommute(Number(e.target.value) || 120)}
          />
        </label>
        <label>
          ≤月租
          <input
            type="number"
            min={500}
            step={100}
            value={maxRent}
            onChange={(e) => setMaxRent(Number(e.target.value) || 20000)}
          />
        </label>
      </div>

      <div className="listing-list dense">
        <div className="list-count">
          房源 {filtered.length}/{listings.length}
          {!company && listings.length > 0 ? ' · 请先设公司' : ''}
        </div>
        {filtered.map((item) => (
          <ListingCard
            key={item.listing.id}
            item={item}
            selected={selectedId === item.listing.id}
            preferredMode={settings.preferredMode}
            onSelect={() => {
              setSelectedId(item.listing.id)
              setSheetExpanded(false)
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
          <p className="hint">
            还没有房源。点「添加房源」或
            <button type="button" className="linkish" onClick={loadDemo}>
              加载示例
            </button>
          </p>
        )}
      </div>
    </>
  )

  return (
    <div className={`app map-first ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'} ${compareOpen ? 'compare-open' : ''}`}>
      <header className="topbar">
        <button
          type="button"
          className="icon-btn topbar-toggle desktop-only"
          title={sidebarOpen ? '收起面板' : '展开面板'}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <div className="brand">
          <MapPin size={18} />
          <h1>北京租房通勤</h1>
          <span className={`pill ${demoMode ? 'warn' : 'ok'}`}>
            {demoMode ? '演示' : canUseAmapJsMap() ? '高德矢量' : '高德'}
          </span>
        </div>
        <div className="topbar-actions">
          <div className="seg">
            <button
              type="button"
              className={settings.preferredMode === 'transit' ? 'active' : ''}
              onClick={() => setSettings({ ...settings, preferredMode: 'transit' })}
              title="公交优先"
            >
              <Bus size={14} />
              <span className="hide-sm">公交</span>
            </button>
            <button
              type="button"
              className={settings.preferredMode === 'driving' ? 'active' : ''}
              onClick={() => setSettings({ ...settings, preferredMode: 'driving' })}
              title="驾车优先"
            >
              <Car size={14} />
              <span className="hide-sm">驾车</span>
            </button>
          </div>
          <button
            type="button"
            className={`btn btn-sm ${compareOpen ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setCompareOpen((v) => !v)}
          >
            <Table2 size={14} />
            <span className="hide-sm">对比</span>
          </button>
          <div className="settings-wrap">
            <button
              type="button"
              className={`btn btn-sm btn-ghost ${settingsOpen ? 'btn-primary' : ''}`}
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <Settings2 size={14} />
            </button>
            {settingsOpen && (
              <div className="settings-dropdown">
                <SettingsBar
                  settings={settings}
                  demoMode={demoMode}
                  onChange={setSettings}
                  onExport={handleExport}
                  onImport={handleImport}
                  onReset={handleResetData}
                  storageKey={STORAGE_KEY}
                />
              </div>
            )}
          </div>
          {listings.length === 0 && (
            <button type="button" className="btn btn-sm btn-primary" onClick={loadDemo}>
              <Sparkles size={14} />
              <span className="hide-sm">示例</span>
            </button>
          )}
        </div>
      </header>

      {showBackupTip && listings.length >= 5 && (
        <div className="backup-banner">
          <span>
            你已收藏 {listings.length} 套房源。数据只存在本机浏览器，网站更新不会清空；但换浏览器/清站点数据会丢。请先
            <strong>导出备份</strong>。
          </span>
          <div className="backup-banner-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={handleExport}>
              <Download size={14} /> 立即导出
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                markReminded(listings.length)
                setShowBackupTip(false)
              }}
            >
              稍后
            </button>
          </div>
        </div>
      )}
      <div className="workspace">
        <aside className={`side-panel ${sidebarOpen ? 'open' : ''}`}>
          <div className="side-panel-inner">{panelBody}</div>
        </aside>

        <main className="map-stage">
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
          {!sidebarOpen && (
            <button
              type="button"
              className="fab-panel desktop-only"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeftOpen size={16} /> 面板
            </button>
          )}
        </main>
      </div>

      {/* Mobile bottom sheet */}
      <div className={`mobile-sheet ${sheetExpanded ? 'expanded' : ''}`}>
        <button
          type="button"
          className="sheet-handle"
          onClick={() => setSheetExpanded((v) => !v)}
        >
          <span className="grip" />
          <span>
            房源 {filtered.length} · {sheetExpanded ? '收起' : '展开列表'}
          </span>
          <ChevronUp size={16} className={sheetExpanded ? '' : 'flip'} />
        </button>
        {sheetExpanded && <div className="sheet-body">{panelBody}</div>}
      </div>

      <div className={`compare-drawer ${compareOpen ? 'open' : ''}`}>
        <div className="compare-drawer-bar">
          <strong>对比表</strong>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCompareOpen(false)}>
            关闭
          </button>
        </div>
        <CompareTable items={filtered} preferredMode={settings.preferredMode} />
      </div>

      <RentalForm
        open={formOpen}
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
    </div>
  )
}

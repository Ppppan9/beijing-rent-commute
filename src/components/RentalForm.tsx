import { useEffect, useState } from 'react'
import { Home, Crosshair, Save, X } from 'lucide-react'
import SearchBox from './SearchBox'
import type { RentalListing } from '../types'
import { LISTING_COLORS } from '../types'
import type { GeoResult } from '../services/amap'
import { uid } from '../utils/storage'

interface Draft {
  name: string
  address: string
  lat: number
  lng: number
  monthlyRent: string
  sizeSqm: string
  depositMonths: string
  agencyFee: string
  otherMonthly: string
  commuteFareOneWay: string
  workdaysPerMonth: string
  notes: string
}

const emptyDraft = (): Draft => ({
  name: '',
  address: '',
  lat: 0,
  lng: 0,
  monthlyRent: '',
  sizeSqm: '',
  depositMonths: '1',
  agencyFee: '0',
  otherMonthly: '0',
  commuteFareOneWay: '',
  workdaysPerMonth: '22',
  notes: '',
})

interface Props {
  editing: RentalListing | null
  pinActive: boolean
  pendingPin: { lat: number; lng: number } | null
  existingCount: number
  onTogglePin: () => void
  onSave: (listing: RentalListing) => void
  onCancel: () => void
  open: boolean
  onOpen?: () => void
}

export default function RentalForm({
  editing,
  pinActive,
  pendingPin,
  existingCount,
  onTogglePin,
  onSave,
  onCancel,
  open,
}: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft())

  useEffect(() => {
    if (editing) {
      setDraft({
        name: editing.name,
        address: editing.address,
        lat: editing.position.lat,
        lng: editing.position.lng,
        monthlyRent: String(editing.monthlyRent),
        sizeSqm: editing.sizeSqm != null ? String(editing.sizeSqm) : '',
        depositMonths: String(editing.depositMonths),
        agencyFee: String(editing.agencyFee),
        otherMonthly: String(editing.otherMonthly),
        commuteFareOneWay:
          editing.commuteFareOneWay != null ? String(editing.commuteFareOneWay) : '',
        workdaysPerMonth: String(editing.workdaysPerMonth),
        notes: editing.notes,
      })
    } else if (open) {
      setDraft(emptyDraft())
    }
  }, [editing, open])

  useEffect(() => {
    if (pendingPin) {
      setDraft((d) => ({
        ...d,
        lat: pendingPin.lat,
        lng: pendingPin.lng,
        address: d.address || `地图选点 ${pendingPin.lat.toFixed(5)}, ${pendingPin.lng.toFixed(5)}`,
        name: d.name || `房源 ${existingCount + 1}`,
      }))
    }
  }, [pendingPin, existingCount])

  const applySearch = (r: GeoResult) => {
    setDraft((d) => ({
      ...d,
      name: d.name || r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
    }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.lat || !draft.lng) {
      alert('请先搜索地址或在地图上选点')
      return
    }
    const rent = Number(draft.monthlyRent)
    if (!rent || rent < 0) {
      alert('请填写有效月租金')
      return
    }
    const color =
      editing?.color ?? LISTING_COLORS[existingCount % LISTING_COLORS.length]
    const listing: RentalListing = {
      id: editing?.id ?? uid(),
      name: draft.name.trim() || draft.address || '未命名房源',
      address: draft.address.trim(),
      position: { lat: draft.lat, lng: draft.lng },
      monthlyRent: rent,
      sizeSqm: draft.sizeSqm ? Number(draft.sizeSqm) : undefined,
      depositMonths: Number(draft.depositMonths) || 0,
      agencyFee: Number(draft.agencyFee) || 0,
      otherMonthly: Number(draft.otherMonthly) || 0,
      commuteFareOneWay: draft.commuteFareOneWay !== '' ? Number(draft.commuteFareOneWay) : undefined,
      workdaysPerMonth: Number(draft.workdaysPerMonth) || 22,
      notes: draft.notes,
      createdAt: editing?.createdAt ?? Date.now(),
      color,
    }
    onSave(listing)
    setDraft(emptyDraft())
  }

  if (!open || pinActive) return null

  const set = (key: keyof Draft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
      <div className="panel-title">
        <Home size={18} />
        <h2>{editing ? '编辑房源' : '添加房源'}</h2>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="关闭">
          <X size={16} />
        </button>
      </div>
      <form onSubmit={submit} className="form-grid">
        <SearchBox placeholder="输入小区名，如 天通苑 / 龙泽苑…" onSelect={applySearch} onPickOnMap={onTogglePin} />
        <div className="btn-row">
          <button
            type="button"
            className={`btn ${pinActive ? 'btn-primary' : 'btn-ghost'}`}
            onClick={onTogglePin}
          >
            <Crosshair size={14} />
            {pinActive ? '点选中…' : '地图选点'}
          </button>
        </div>
        {(draft.lat !== 0 || draft.lng !== 0) && (
          <div className="info-meta">
            坐标 {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
          </div>
        )}
        <label>
          名称
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="小区 / 公寓名" />
        </label>
        <label>
          地址
          <input value={draft.address} onChange={(e) => set('address', e.target.value)} />
        </label>
        <div className="form-2col">
          <label>
            月租金 (¥) *
            <input
              type="number"
              min={0}
              value={draft.monthlyRent}
              onChange={(e) => set('monthlyRent', e.target.value)}
              required
            />
          </label>
          <label>
            面积 (㎡)
            <input
              type="number"
              min={0}
              step={0.1}
              value={draft.sizeSqm}
              onChange={(e) => set('sizeSqm', e.target.value)}
            />
          </label>
        </div>
        <div className="form-2col">
          <label>
            押金（月）
            <input
              type="number"
              min={0}
              step={0.5}
              value={draft.depositMonths}
              onChange={(e) => set('depositMonths', e.target.value)}
            />
          </label>
          <label>
            中介费 (¥)
            <input
              type="number"
              min={0}
              value={draft.agencyFee}
              onChange={(e) => set('agencyFee', e.target.value)}
            />
          </label>
        </div>
        <div className="form-2col">
          <label>
            其他月支出 (¥)
            <input
              type="number"
              min={0}
              value={draft.otherMonthly}
              onChange={(e) => set('otherMonthly', e.target.value)}
              placeholder="物业/宽带等"
            />
          </label>
          <label>
            单程通勤费 (¥)
            <input
              type="number"
              min={0}
              step={0.5}
              value={draft.commuteFareOneWay}
              onChange={(e) => set('commuteFareOneWay', e.target.value)}
              placeholder="空=自动估算"
            />
          </label>
        </div>
        <label>
          每月工作日
          <input
            type="number"
            min={1}
            max={31}
            value={draft.workdaysPerMonth}
            onChange={(e) => set('workdaysPerMonth', e.target.value)}
          />
        </label>
        <label>
          备注
          <textarea
            rows={2}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="朝向、楼层、是否可做饭…"
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block">
          <Save size={14} /> 保存到收藏
        </button>
      </form>
    </section>
    </div>
  )
}

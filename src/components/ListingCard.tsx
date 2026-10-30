import { Pencil, Trash2, Bus, Car, Star, Clock, Wallet } from 'lucide-react'
import type { ScoredListing } from '../types'
import { formatCNY } from '../utils/cost'

interface Props {
  item: ScoredListing
  selected: boolean
  preferredMode: 'transit' | 'driving'
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function ListingCard({
  item,
  selected,
  preferredMode,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  const { listing, commute, cost, valueScore, rank, scoreDetail } = item
  const route =
    preferredMode === 'driving'
      ? commute?.driving || commute?.transit
      : commute?.transit || commute?.driving

  return (
    <article
      className={`listing-card ${selected ? 'selected' : ''} ${rank === 1 ? 'best' : ''}`}
      onClick={onSelect}
      style={{ borderLeftColor: listing.color }}
    >
      <div className="listing-head">
        <span className="rank-badge" style={{ background: listing.color }}>
          #{rank}
        </span>
        <div className="listing-titles">
          <h3>{listing.name}</h3>
          <p>{listing.address}</p>
        </div>
        <div className="score-pill" title="综合推荐分">
          <Star size={12} /> {valueScore}
        </div>
      </div>

      <div className="listing-stats">
        <div>
          <Clock size={13} />
          {route ? (
            <span>
              {route.durationMin} 分钟 · {route.distanceKm} km
              {route.estimated ? '（估）' : ''}
            </span>
          ) : (
            <span>计算路线中…</span>
          )}
        </div>
        <div>
          {preferredMode === 'driving' ? <Car size={13} /> : <Bus size={13} />}
          <span>{route?.summary || (preferredMode === 'driving' ? '驾车' : '公交/地铁')}</span>
        </div>
        <div>
          <Wallet size={13} />
          <span>有效月成本 {formatCNY(cost.effectiveMonthly)}</span>
        </div>
      </div>

      <div className="cost-mini">
        <span>租金 {formatCNY(cost.monthlyRent)}</span>
        <span>通勤 {formatCNY(cost.commuteMonthly)}/月</span>
        <span>首月约 {formatCNY(cost.firstMonthTotal)}</span>
        {listing.sizeSqm ? <span>{listing.sizeSqm}㎡</span> : null}
      </div>

      <div className="score-bars">
        <div className="bar">
          <label>通勤</label>
          <div className="track">
            <i style={{ width: `${scoreDetail.commuteScore}%` }} />
          </div>
        </div>
        <div className="bar">
          <label>成本</label>
          <div className="track">
            <i style={{ width: `${scoreDetail.costScore}%` }} />
          </div>
        </div>
        <div className="bar">
          <label>面积</label>
          <div className="track">
            <i style={{ width: `${scoreDetail.sizeScore}%` }} />
          </div>
        </div>
      </div>

      {listing.notes && <p className="notes">{listing.notes}</p>}

      <div className="listing-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
          <Pencil size={12} /> 编辑
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
          <Trash2 size={12} /> 删除
        </button>
      </div>
    </article>
  )
}

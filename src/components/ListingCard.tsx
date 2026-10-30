import { Pencil, Trash2, Bus, Car, Star, Clock } from 'lucide-react'
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
  const { listing, commute, cost, valueScore, rank } = item
  const route =
    preferredMode === 'driving'
      ? commute?.driving || commute?.transit
      : commute?.transit || commute?.driving

  return (
    <article
      className={`listing-row ${selected ? 'selected' : ''} ${rank === 1 ? 'best' : ''}`}
      onClick={onSelect}
      style={{ ['--accent' as string]: listing.color }}
    >
      <span className="listing-row-rank" style={{ background: listing.color }}>
        {rank}
      </span>
      <div className="listing-row-main">
        <div className="listing-row-top">
          <h3>{listing.name}</h3>
          <span className="score-pill compact" title="推荐分">
            <Star size={11} /> {valueScore}
          </span>
        </div>
        <div className="listing-row-meta">
          <span title="通勤">
            <Clock size={12} />
            {route ? `${route.durationMin}分` : '…'}
            {route?.estimated ? '估' : ''}
          </span>
          <span title="交通方式">
            {preferredMode === 'driving' ? <Car size={12} /> : <Bus size={12} />}
            {route ? `${route.distanceKm}km` : '—'}
          </span>
          <span className="rent">{formatCNY(listing.monthlyRent)}/月</span>
          <span className="eff">{formatCNY(cost.effectiveMonthly)}有效</span>
          {listing.sizeSqm ? <span>{listing.sizeSqm}㎡</span> : null}
        </div>
      </div>
      <div className="listing-row-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn" title="编辑" onClick={onEdit}>
          <Pencil size={14} />
        </button>
        <button type="button" className="icon-btn danger" title="删除" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  )
}

import { Crosshair, X } from 'lucide-react'
import SearchBox from './SearchBox'
import type { CompanyLocation } from '../types'
import type { GeoResult } from '../services/amap'

interface Props {
  company: CompanyLocation | null
  pinActive: boolean
  onSetCompany: (c: CompanyLocation) => void
  onTogglePin: () => void
  onClear: () => void
}

export default function CompanyPanel({
  company,
  pinActive,
  onSetCompany,
  onTogglePin,
  onClear,
}: Props) {
  const apply = (r: GeoResult) => {
    onSetCompany({
      name: r.name,
      address: r.address,
      position: { lat: r.lat, lng: r.lng },
    })
  }

  return (
    <div className="compact-block">
      <div className="compact-label">公司</div>
      <SearchBox placeholder="搜索公司 / 写字楼…" onSelect={apply} />
      <div className="compact-actions">
        <button
          type="button"
          className={`btn btn-sm ${pinActive ? 'btn-primary' : 'btn-ghost'}`}
          onClick={onTogglePin}
        >
          <Crosshair size={13} />
          {pinActive ? '点选中…' : '地图选点'}
        </button>
        {company && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
            <X size={13} /> 清除
          </button>
        )}
      </div>
      {company && (
        <div className="compact-chip" title={company.address}>
          <strong>{company.name}</strong>
          <span>{company.address}</span>
        </div>
      )}
    </div>
  )
}

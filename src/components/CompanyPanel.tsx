import { Building2, Crosshair } from 'lucide-react'
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
    <section className="panel">
      <div className="panel-title">
        <Building2 size={18} />
        <h2>公司位置</h2>
      </div>
      <SearchBox placeholder="搜索公司地址 / 写字楼…" onSelect={apply} />
      <div className="btn-row">
        <button
          type="button"
          className={`btn ${pinActive ? 'btn-primary' : 'btn-ghost'}`}
          onClick={onTogglePin}
        >
          <Crosshair size={14} />
          {pinActive ? '点选中…再点取消' : '地图选点'}
        </button>
        {company && (
          <button type="button" className="btn btn-ghost" onClick={onClear}>
            清除
          </button>
        )}
      </div>
      {company && (
        <div className="info-card company-card">
          <div className="info-name">{company.name}</div>
          <div className="info-addr">{company.address}</div>
          <div className="info-meta">
            {company.position.lat.toFixed(5)}, {company.position.lng.toFixed(5)}
          </div>
        </div>
      )}
    </section>
  )
}

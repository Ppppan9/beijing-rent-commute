import { Download, Upload, Settings2, Bus, Car } from 'lucide-react'
import type { AppSettings } from '../types'

interface Props {
  settings: AppSettings
  demoMode: boolean
  onChange: (s: AppSettings) => void
  onExport: () => void
  onImport: (file: File) => void
}

export default function SettingsBar({
  settings,
  demoMode,
  onChange,
  onExport,
  onImport,
}: Props) {
  return (
    <section className="panel settings-panel">
      <div className="panel-title">
        <Settings2 size={18} />
        <h2>偏好与数据</h2>
        {demoMode && <span className="badge-demo">演示模式</span>}
        {!demoMode && <span className="badge-amap">高德 API</span>}
      </div>

      <div className="mode-toggle">
        <button
          type="button"
          className={`btn ${settings.preferredMode === 'transit' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onChange({ ...settings, preferredMode: 'transit' })}
        >
          <Bus size={14} /> 公交优先
        </button>
        <button
          type="button"
          className={`btn ${settings.preferredMode === 'driving' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onChange({ ...settings, preferredMode: 'driving' })}
        >
          <Car size={14} /> 驾车优先
        </button>
      </div>

      <div className="form-2col">
        <label>
          默认地铁单程 (¥)
          <input
            type="number"
            min={0}
            step={0.5}
            value={settings.defaultTransitFare}
            onChange={(e) =>
              onChange({ ...settings, defaultTransitFare: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label>
          驾车 ¥/km
          <input
            type="number"
            min={0}
            step={0.1}
            value={settings.drivingCostPerKm}
            onChange={(e) =>
              onChange({ ...settings, drivingCostPerKm: Number(e.target.value) || 0 })
            }
          />
        </label>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onExport}>
          <Download size={14} /> 导出 JSON
        </button>
        <label className="btn btn-ghost file-btn">
          <Upload size={14} /> 导入 JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {demoMode && (
        <p className="hint">
          未配置 <code>VITE_AMAP_KEY</code>：使用 OSM 地图 + 地标/Nominatim 搜索 + OSRM/估算路线。配置高德 Key 后可获北京公交真实路线。
        </p>
      )}
    </section>
  )
}

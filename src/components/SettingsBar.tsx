import { Download, Upload, Bus, Car, Trash2 } from 'lucide-react'
import type { AppSettings } from '../types'

interface Props {
  settings: AppSettings
  demoMode: boolean
  onChange: (s: AppSettings) => void
  onExport: () => void
  onImport: (file: File) => void
  onReset?: () => void
  storageKey?: string
}

export default function SettingsBar({
  settings,
  demoMode,
  onChange,
  onExport,
  onImport,
  onReset,
  storageKey,
}: Props) {
  return (
    <div className="settings-popover-body">
      <div className="settings-head">
        <span>偏好与数据</span>
        {demoMode ? (
          <span className="badge-demo">演示</span>
        ) : (
          <span className="badge-amap">高德 API</span>
        )}
      </div>
      <p className="hint">
        收藏数据保存在本机 <code>{storageKey || 'localStorage'}</code>
        。代码/Pages 更新<strong>不会</strong>自动清空。清浏览器站点数据或换设备会丢失，请定期「导出备份」。
      </p>
      <div className="mode-toggle">
        <button
          type="button"
          className={`btn btn-sm ${settings.preferredMode === 'transit' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onChange({ ...settings, preferredMode: 'transit' })}
        >
          <Bus size={13} /> 公交
        </button>
        <button
          type="button"
          className={`btn btn-sm ${settings.preferredMode === 'driving' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onChange({ ...settings, preferredMode: 'driving' })}
        >
          <Car size={13} /> 驾车
        </button>
      </div>
      <div className="form-2col">
        <label>
          地铁单程 ¥
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
        <button type="button" className="btn btn-sm btn-primary" onClick={onExport}>
          <Download size={13} /> 导出备份
        </button>
        <label className="btn btn-sm btn-ghost file-btn">
          <Upload size={13} /> 导入
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
      {onReset && (
        <button type="button" className="btn btn-sm btn-danger btn-block" onClick={onReset}>
          <Trash2 size={13} /> 清空本地数据（需确认）
        </button>
      )}
    </div>
  )
}

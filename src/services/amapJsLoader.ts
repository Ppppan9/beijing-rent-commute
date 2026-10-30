import { getAmapJsKey, getAmapSecurityCode, hasAmapJsKey } from './amap'

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode?: string }
    AMap?: AMapNamespace
  }
}

export interface AMapNamespace {
  Map: new (el: string | HTMLElement, opts?: Record<string, unknown>) => AMapMap
  Marker: new (opts?: Record<string, unknown>) => AMapOverlay
  Polyline: new (opts?: Record<string, unknown>) => AMapOverlay
  Pixel: new (x: number, y: number) => unknown
  Icon: new (opts?: Record<string, unknown>) => unknown
  Size: new (w: number, h: number) => unknown
  plugin: (name: string | string[], cb: () => void) => void
}

export interface AMapMap {
  destroy: () => void
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean) => void
  setFitView: (overlays?: unknown[], immediately?: boolean, avoid?: number[]) => void
  clearMap: () => void
  add: (o: unknown) => void
  on: (ev: string, fn: (e: { lnglat: { getLng: () => number; getLat: () => number } }) => void) => void
  off: (ev: string, fn: (...args: unknown[]) => void) => void
  getZoom: () => number
}

export interface AMapOverlay {
  setMap: (map: AMapMap | null) => void
  on: (ev: string, fn: () => void) => void
}

let loading: Promise<AMapNamespace> | null = null

export function canUseAmapJsMap(): boolean {
  return hasAmapJsKey()
}

/** 必须在加载 maps 脚本之前设置 securityJsCode */
function applySecurityConfig() {
  const security = getAmapSecurityCode()
  if (security) {
    window._AMapSecurityConfig = { securityJsCode: security }
  }
}

export function loadAmapJs(): Promise<AMapNamespace> {
  if (typeof window !== 'undefined' && window.AMap) {
    applySecurityConfig()
    return Promise.resolve(window.AMap)
  }
  if (loading) return loading

  const key = getAmapJsKey()
  if (!key) return Promise.reject(new Error('缺少 VITE_AMAP_JS_KEY'))

  applySecurityConfig()

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`
    script.async = true
    script.onload = () => {
      if (window.AMap) resolve(window.AMap)
      else reject(new Error('AMap 加载失败'))
    }
    script.onerror = () => {
      loading = null
      reject(new Error('AMap 脚本加载失败（请检查 Key 类型为 Web端 JS API，并白名单 ppppan9.github.io）'))
    }
    document.head.appendChild(script)
  })
  return loading
}

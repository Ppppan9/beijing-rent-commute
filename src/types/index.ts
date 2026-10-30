/** 经纬度（WGS84 / GCJ-02 近似，演示模式用 OSM；有高德 Key 时用高德坐标） */
export interface LatLng {
  lat: number
  lng: number
}

export interface CompanyLocation {
  name: string
  address: string
  position: LatLng
}

export interface RentalListing {
  id: string
  name: string
  address: string
  position: LatLng
  /** 月租金（元） */
  monthlyRent: number
  /** 面积㎡，可选 */
  sizeSqm?: number
  /** 押金月数，如 1 表示押一 */
  depositMonths: number
  /** 中介费（一次性，元），0 表示无 */
  agencyFee: number
  /** 其他每月固定支出（物业/宽带等） */
  otherMonthly: number
  /** 用户自定义单程通勤费用（元），空则用自动估算 */
  commuteFareOneWay?: number
  /** 每月工作日天数，默认 22 */
  workdaysPerMonth: number
  notes: string
  createdAt: number
  color: string
}

export interface CommuteRoute {
  mode: 'driving' | 'transit' | 'walking'
  durationMin: number
  distanceKm: number
  /** GeoJSON-ish polyline [[lat,lng],...] */
  path: [number, number][]
  /** 换乘说明等 */
  summary?: string
  estimated: boolean
}

export interface CommuteInfo {
  driving?: CommuteRoute
  transit?: CommuteRoute
  preferred: 'driving' | 'transit'
}

export interface CostBreakdown {
  monthlyRent: number
  otherMonthly: number
  depositTotal: number
  agencyFee: number
  commuteMonthly: number
  commuteFareOneWay: number
  /** 首月现金支出 ≈ 租金 + 押金 + 中介 + 其他 + 通勤 */
  firstMonthTotal: number
  /** 年总成本（含一次性摊销） */
  annualTotal: number
  /** 有效月成本 = 租金 + 其他 + 通勤 + (押金+中介)/12（押金按占用一年摊） */
  effectiveMonthly: number
}

export interface ScoredListing {
  listing: RentalListing
  commute: CommuteInfo | null
  cost: CostBreakdown
  /** 0–100，越高越好 */
  valueScore: number
  rank: number
  scoreDetail: {
    commuteScore: number
    costScore: number
    sizeScore: number
  }
}

export interface AppSettings {
  /** 默认单程通勤票价估算（元），地铁约 4–6 */
  defaultTransitFare: number
  /** 驾车单程油费/打车估算基数（元/km） */
  drivingCostPerKm: number
  preferredMode: 'transit' | 'driving'
  /** 评分权重 */
  weights: {
    commute: number
    cost: number
    size: number
  }
}

export interface AppState {
  company: CompanyLocation | null
  listings: RentalListing[]
  settings: AppSettings
  version: number
}

export const LISTING_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#9b59b6',
  '#f39c12',
  '#1abc9c',
  '#e67e22',
  '#34495e',
]

export const DEFAULT_SETTINGS: AppSettings = {
  defaultTransitFare: 5,
  drivingCostPerKm: 1.2,
  preferredMode: 'transit',
  weights: { commute: 0.4, cost: 0.45, size: 0.15 },
}

/** 北京常见地标，演示模式快速选点 */
export const BEIJING_LANDMARKS: { name: string; address: string; position: LatLng }[] = [
  { name: '国贸 CBD', address: '北京市朝阳区建国门外大街1号', position: { lat: 39.9087, lng: 116.4604 } },
  { name: '中关村', address: '北京市海淀区中关村大街', position: { lat: 39.9834, lng: 116.3162 } },
  { name: '望京 SOHO', address: '北京市朝阳区望京街10号', position: { lat: 39.9965, lng: 116.4808 } },
  { name: '西二旗', address: '北京市海淀区西二旗大街', position: { lat: 40.053, lng: 116.306 } },
  { name: '亦庄', address: '北京市大兴区亦庄经济技术开发区', position: { lat: 39.795, lng: 116.506 } },
  { name: '金融街', address: '北京市西城区金融大街', position: { lat: 39.915, lng: 116.356 } },
  { name: '三里屯', address: '北京市朝阳区三里屯路', position: { lat: 39.9375, lng: 116.455 } },
  { name: '五道口', address: '北京市海淀区成府路', position: { lat: 39.9925, lng: 116.337 } },
  { name: '回龙观', address: '北京市昌平区回龙观西大街', position: { lat: 40.074, lng: 116.331 } },
  { name: '通州北苑', address: '北京市通州区北苑', position: { lat: 39.908, lng: 116.646 } },
  { name: '天安门', address: '北京市东城区天安门广场', position: { lat: 39.9087, lng: 116.3975 } },
  { name: '首都机场 T3', address: '北京市朝阳区首都国际机场', position: { lat: 40.0799, lng: 116.6031 } },
]

import type { AppSettings, CostBreakdown, CommuteInfo, RentalListing } from '../types'

/** 估算单程通勤费用（元） */
export function estimateOneWayFare(
  listing: RentalListing,
  commute: CommuteInfo | null,
  settings: AppSettings,
): number {
  if (listing.commuteFareOneWay != null && listing.commuteFareOneWay >= 0) {
    return listing.commuteFareOneWay
  }
  const mode = settings.preferredMode
  if (!commute) return settings.defaultTransitFare

  if (mode === 'driving' && commute.driving) {
    return Math.round(commute.driving.distanceKm * settings.drivingCostPerKm * 10) / 10
  }
  if (commute.transit) {
    // 北京地铁分段：约 3–10 元，按距离粗估
    const km = commute.transit.distanceKm
    if (km <= 6) return 3
    if (km <= 12) return 4
    if (km <= 22) return 5
    if (km <= 32) return 6
    return Math.min(10, 7 + Math.floor((km - 32) / 20))
  }
  return settings.defaultTransitFare
}

export function calcCostBreakdown(
  listing: RentalListing,
  commute: CommuteInfo | null,
  settings: AppSettings,
): CostBreakdown {
  const monthlyRent = listing.monthlyRent || 0
  const otherMonthly = listing.otherMonthly || 0
  const depositTotal = monthlyRent * (listing.depositMonths || 0)
  const agencyFee = listing.agencyFee || 0
  const commuteFareOneWay = estimateOneWayFare(listing, commute, settings)
  const workdays = listing.workdaysPerMonth || 22
  // 往返
  const commuteMonthly = Math.round(commuteFareOneWay * 2 * workdays * 10) / 10

  const firstMonthTotal =
    monthlyRent + depositTotal + agencyFee + otherMonthly + commuteMonthly

  // 年成本：12 个月租金 + 其他 + 通勤 + 中介；押金假设一年后退还不计损耗
  const annualTotal =
    monthlyRent * 12 + otherMonthly * 12 + commuteMonthly * 12 + agencyFee

  // 有效月成本：租金 + 其他 + 通勤 + 中介/12 + 押金资金占用（按年利率约 2% 摊到月 ≈ 押金*0.02/12）
  const depositOpportunity = (depositTotal * 0.02) / 12
  const effectiveMonthly =
    Math.round(
      (monthlyRent + otherMonthly + commuteMonthly + agencyFee / 12 + depositOpportunity) * 10,
    ) / 10

  return {
    monthlyRent,
    otherMonthly,
    depositTotal,
    agencyFee,
    commuteMonthly,
    commuteFareOneWay,
    firstMonthTotal: Math.round(firstMonthTotal * 10) / 10,
    annualTotal: Math.round(annualTotal * 10) / 10,
    effectiveMonthly,
  }
}

export function formatCNY(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}`
}

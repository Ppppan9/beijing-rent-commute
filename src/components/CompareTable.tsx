import type { ScoredListing } from '../types'
import { formatCNY } from '../utils/cost'

interface Props {
  items: ScoredListing[]
  preferredMode: 'transit' | 'driving'
}

export default function CompareTable({ items, preferredMode }: Props) {
  if (items.length === 0) return null

  return (
    <section className="panel compare-panel">
      <div className="panel-title">
        <h2>对比表</h2>
      </div>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>房源</th>
              <th>推荐分</th>
              <th>通勤</th>
              <th>月租</th>
              <th>通勤月费</th>
              <th>有效月成本</th>
              <th>首月合计</th>
              <th>年成本</th>
              <th>押金</th>
              <th>中介</th>
              <th>面积</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const route =
                preferredMode === 'driving'
                  ? it.commute?.driving || it.commute?.transit
                  : it.commute?.transit || it.commute?.driving
              return (
                <tr key={it.listing.id} className={it.rank === 1 ? 'best-row' : ''}>
                  <td>
                    <span className="rank-badge" style={{ background: it.listing.color }}>
                      #{it.rank}
                    </span>
                  </td>
                  <td className="name-cell">{it.listing.name}</td>
                  <td>
                    <strong>{it.valueScore}</strong>
                  </td>
                  <td>
                    {route
                      ? `${route.durationMin}分 / ${route.distanceKm}km`
                      : '—'}
                  </td>
                  <td>{formatCNY(it.cost.monthlyRent)}</td>
                  <td>{formatCNY(it.cost.commuteMonthly)}</td>
                  <td>
                    <strong>{formatCNY(it.cost.effectiveMonthly)}</strong>
                  </td>
                  <td>{formatCNY(it.cost.firstMonthTotal)}</td>
                  <td>{formatCNY(it.cost.annualTotal)}</td>
                  <td>{formatCNY(it.cost.depositTotal)}</td>
                  <td>{formatCNY(it.cost.agencyFee)}</td>
                  <td>{it.listing.sizeSqm ? `${it.listing.sizeSqm}㎡` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        有效月成本 = 月租 + 其他月支出 + 通勤月费 + 中介费/12 + 押金资金占用(约 2%/年)。推荐分在当前收藏集内相对归一化。
      </p>
    </section>
  )
}

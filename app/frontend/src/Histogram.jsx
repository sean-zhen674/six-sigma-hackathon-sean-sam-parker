import { useState } from 'react'
import { histogramBins, histogramSummary } from './calc.js'
import { fmt } from './format.js'
import { TEXT } from './labels.js'
import { chartDomain, makeScale, niceTicks, placeLineLabels } from './scale.js'

// One histogram of the baseline coupons, drawn as inline SVG like ControlChart. Every number (the
// bin edges, the counts, the allowed values and the process average) comes from the API; this
// component only turns them into pixels.
//
// props:
//   q    one entry of QUALITY (title, unit, digits)
//   cap  result.capability[q.key]: histogram, mean, lsl, usl

const W = 560
const H = 300
const M = { left: 16, right: 16, top: 62, bottom: 46 }
const LABEL_ROW = 16 // height of one line label row
const CHAR_WIDTH = 6.8 // average width of one character at 12 px, to keep labels apart and inside

const BAR_FILL = '#93c5fd'
const BAR_EDGE = '#1d4ed8'
const LIMIT_COLOR = '#6d28d9'
const MEAN_COLOR = '#065f46'

export default function Histogram({ q, cap }) {
  const [hover, setHover] = useState(null) // index of the bar being pointed at (hover, or tap on a phone)
  const hist = cap.histogram
  const bins = histogramBins(hist)
  const unit = q.unit ? ` ${q.unit}` : ''
  if (bins.length === 0) return <p className="muted">No histogram is available.</p>

  const left = M.left
  const right = W - M.right
  const top = M.top
  const bottom = H - M.bottom

  // The lines: the allowed values (dashed) and the process average (solid).
  const lines = []
  if (typeof cap.lsl === 'number') lines.push({ name: 'Lowest allowed', value: cap.lsl, color: LIMIT_COLOR, dash: '6 4' })
  if (typeof cap.usl === 'number') lines.push({ name: 'Highest allowed', value: cap.usl, color: LIMIT_COLOR, dash: '6 4' })
  lines.push({ name: 'Process average', value: cap.mean, color: MEAN_COLOR, dash: null })

  const domain = chartDomain(hist.edges, lines.map((l) => l.value)) // covers the bars and every line
  const x = makeScale(domain[0], domain[1], left, right)
  const mostCoupons = Math.max(...bins.map((b) => b.count), 1)
  const y = makeScale(0, mostCoupons, bottom, top + 8)

  const labelText = lines.map((l) => `${l.name} ${fmt(l.value, q.digits)}${unit}`)
  const placed = placeLineLabels(lines.map((l, k) => ({ x: x(l.value), width: labelText[k].length * CHAR_WIDTH })), left - 8, right + 8)

  const ticks = niceTicks(domain[0], domain[1], 5)

  const bar = (b) => {
    const x0 = x(b.from)
    const width = x(b.to) - x0
    return width >= 6 ? { x: x0, width } : { x: x0 + width / 2 - 3, width: 6 } // a bin of equal values has no width: draw a thin bar
  }
  const tip = hover === null ? null : bins[hover]
  const tipBar = tip ? bar(tip) : null
  const tipX = tip ? tipBar.x + tipBar.width / 2 : 0
  const tipY = tip ? y(tip.count) : 0

  return (
    <figure className="chart histogram">
      <figcaption><strong>{q.title}: Histogram of the baseline coupons</strong></figcaption>
      <p className="chart-help">{TEXT.histAxis}</p>
      <div className="chart-scroll">
        <div className="chart-plot">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={histogramSummary(q, cap)}>
            {bins.map((b, i) => {
              const r = bar(b)
              return (
                <g key={i}>
                  <rect x={r.x} y={y(b.count)} width={r.width} height={bottom - y(b.count)} fill={BAR_FILL} stroke={BAR_EDGE} strokeWidth="1" />
                  {hover === i && <rect x={r.x} y={y(b.count)} width={r.width} height={bottom - y(b.count)} fill="none" stroke="#0f172a" strokeWidth="2" />}
                  <rect
                    x={r.x} y={top} width={r.width} height={bottom - top} fill="transparent"
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                    onClick={() => setHover(hover === i ? null : i)}
                  />
                </g>
              )
            })}

            <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#64748b" />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} y1={bottom} x2={x(t)} y2={bottom + 4} stroke="#64748b" />
                <text x={x(t)} y={bottom + 18} fontSize="12" textAnchor="middle" fill="#334155">{fmt(t, q.digits)}</text>
              </g>
            ))}
            <text x={(left + right) / 2} y={H - 4} fontSize="12" textAnchor="middle" fill="#334155">{q.title}{unit ? ` (${q.unit})` : ''}</text>

            {lines.map((l, k) => {
              const rowY = 14 + placed[k].row * LABEL_ROW
              return (
                <g key={l.name} pointerEvents="none">
                  <line x1={x(l.value)} y1={rowY + 4} x2={x(l.value)} y2={bottom} stroke={l.color} strokeWidth={l.dash ? 2 : 2.5} strokeDasharray={l.dash ?? undefined} />
                  <text x={placed[k].anchor === 'start' ? x(l.value) + 4 : x(l.value) - 4} y={rowY} fontSize="12" fontWeight="600" textAnchor={placed[k].anchor} fill={l.color}>{labelText[k]}</text>
                </g>
              )
            })}
          </svg>
          {tip && (
            <div
              className={`chart-tip${tipX > (left + right) / 2 ? ' left' : ''}${tipX < left + (right - left) * 0.3 ? ' start' : ''}${tipY < H * 0.45 ? ' below' : ''}`}
              style={{ left: `${(tipX / W) * 100}%`, top: `${(tipY / H) * 100}%` }}
              role="status"
            >
              <span>{fmt(tip.from, q.digits)} to {fmt(tip.to, q.digits)}{unit}: {tip.count} {tip.count === 1 ? 'coupon' : 'coupons'}</span>
            </div>
          )}
        </div>
      </div>
      <p className="chart-note">{TEXT.histCaption.replace('{n}', String(hist.n)).replace('{builds}', String(hist.n_builds))}</p>
      <ul className="sr-only" aria-label="Number of coupons in each range">
        {bins.map((b, i) => <li key={i}>{fmt(b.from, q.digits)} to {fmt(b.to, q.digits)}{unit}: {b.count} {b.count === 1 ? 'coupon' : 'coupons'}</li>)}
      </ul>
    </figure>
  )
}

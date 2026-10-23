import { useState } from 'react'
import { chartDomain, makeScale, spreadLabels, xPosition } from './scale.js'
import { CHART_HELP, fmt, rulesBroken, shortBuild } from './format.js'
import { rulePhrase } from './plain.js'

/** The one-line plain description under a chart title. kind = 'xbar' | 'r' | 'i' | 'mr'. */
export function ChartHelp({ kind }) {
  return CHART_HELP[kind] ? <p className="chart-help">{CHART_HELP[kind]}</p> : null
}

// One control chart drawn as inline SVG. Every number (centre line, limits, points, which rules
// fired) is passed in from the API; this component only turns them into pixels.
//
// props:
//   title, unit      text for the heading (it already names the unit) and for the hover text; unit is the symbol (MPa, %, ppm, W, ...)
//   kind            'xbar' | 'r' | 'i' | 'mr': picks the one-line help text under the title
//   buildIds         x labels, one per point
//   values           the plotted points (null = no point, used by the MR chart)
//   cl, ucl, lcl     lines from the API
//   rules            for each point, the list of rule numbers it broke ([] = none)
//   baselineN        how many first builds were used for the limits (shaded)
//   digits           decimals for labels

const W = 560
const H = 258
const M = { left: 56, right: 104, top: 24, bottom: 42 }

const NOT_FLAGGED_COLOR = '#1d4ed8'
const FLAGGED_COLOR = '#b42318'

export default function ControlChart({
  title, kind, unit, buildIds, values, cl, ucl, lcl, rules, baselineN, digits = 2,
}) {
  const [hover, setHover] = useState(null) // index of the point being pointed at (hover, or tap on a phone)
  const n = values.length
  const left = M.left
  const right = W - M.right
  const top = M.top
  const bottom = H - M.bottom

  const limits = [cl, ucl, lcl]
  const domain = chartDomain(values, limits)
  const y = makeScale(domain[0], domain[1], bottom, top)
  const x = (i) => xPosition(i, n, left, right)
  const step = n > 1 ? (right - left) / (n - 1) : 0

  const flaggedIds = buildIds.filter((_, i) => rules[i] && rules[i].length > 0)

  // points joined by a line (skip null values)
  const path = values
    .map((v, i) => (v === null || v === undefined ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .join(' ')

  // Three control lines (tag and value drawn at the right edge of the chart; full names are in the chart's screen reader text).
  const lines = [
    { tag: 'Upper', full: 'Upper control limit', value: ucl, color: FLAGGED_COLOR },
    { tag: 'Center', full: 'Center line', value: cl, color: '#067647' },
    { tag: 'Lower', full: 'Lower control limit', value: lcl, color: FLAGGED_COLOR },
  ]
  // Every label on the right edge: one text line per control line.
  const labels = lines.map((l) => ({ text: `${l.tag} ${fmt(l.value, digits)}`, color: l.color, value: l.value, h: 17 }))
  const labelY = spreadLabels(labels.map((l) => ({ y: y(l.value), h: l.h })), 2, bottom)

  const ticks = buildIds.map((id, i) => ({ id, i })).filter(({ i }) => i % 5 === 0 || i === n - 1)

  const baselineLeft = Math.max(left - step / 2, left - 8) // few builds: keep the shading inside the chart
  const baselineRight = baselineN ? Math.min(x(Math.min(baselineN, n) - 1) + step / 2, right + 8) : null

  return (
    <figure className="chart">
      <figcaption>
        <strong>{title}</strong>
      </figcaption>
      <ChartHelp kind={kind} />
      <div className="chart-scroll">
        <div className="chart-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={`${title}. ${baselineRight !== null ? `Shaded area: Baseline builds 1 to ${Math.min(baselineN, n)}. ` : ''}${lines.map((l) => `${l.full} ${fmt(l.value, digits)}.`).join(' ')} ${flaggedIds.length ? `Out of control: ${flaggedIds.join(', ')}.` : 'No build breaks a rule.'}`}
        >
          {baselineRight !== null && (
            <g>
              <rect x={baselineLeft} y={top} width={baselineRight - baselineLeft} height={bottom - top} fill="#e0ecff" />
            </g>
          )}

          <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#64748b" />
          <line x1={left} y1={top} x2={left} y2={bottom} stroke="#64748b" />
          {ticks.map(({ id, i }) => (
            <text key={id} x={x(i)} y={bottom + 16} fontSize="12" textAnchor="middle" fill="#334155">{shortBuild(id)}</text>
          ))}
          <text x={(left + right) / 2} y={H - 4} fontSize="12" textAnchor="middle" fill="#334155">build</text>

          {lines.map((l) => (
            <line key={l.full} x1={left} y1={y(l.value)} x2={right} y2={y(l.value)} stroke={l.color} strokeWidth="1.5" />
          ))}
          {labels.map((l, k) => (
            <text key={k} x={right + 6} fontSize="12" fill={l.color}>
              <tspan x={right + 6} y={labelY[k] + 4}>{l.text}</tspan>
            </text>
          ))}

          <polyline points={path} fill="none" stroke={NOT_FLAGGED_COLOR} strokeWidth="1.5" />

          {values.map((v, i) => {
            if (v === null || v === undefined) return null
            const broke = rules[i] && rules[i].length > 0
            const cx = x(i)
            const cy = y(v)
            return (
              <g key={i}>
                {broke ? (
                  <polygon
                    points={`${cx},${cy - 7} ${cx + 7},${cy} ${cx},${cy + 7} ${cx - 7},${cy}`}
                    fill={FLAGGED_COLOR}
                    stroke="#fff"
                    strokeWidth="1"
                  />
                ) : (
                  <circle cx={cx} cy={cy} r="3.5" fill={NOT_FLAGGED_COLOR} />
                )}
                {hover === i && <circle cx={cx} cy={cy} r="9" fill="none" stroke="#0f172a" strokeWidth="1.5" />}
                <circle
                  cx={cx} cy={cy} r="10" fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            )
          })}
        </svg>
        {hover !== null && values[hover] !== null && values[hover] !== undefined && (
          <div
            className={`chart-tip${x(hover) > (left + right) / 2 ? ' left' : ''}${x(hover) < left + (right - left) * 0.3 ? ' start' : ''}${y(values[hover]) < H * 0.4 ? ' below' : ''}`}
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(values[hover]) / H) * 100}%` }}
            role="status"
          >
            <strong>{buildIds[hover]}</strong>
            <span>Value: {fmt(values[hover], digits)}{unit ? ' ' + unit : ''}</span>
            {rules[hover] && rules[hover].length > 0
              ? <span className="tip-rule">Rules broken: {rules[hover].join(', ')} (See "What the rules mean" below)</span>
              : <span>No rule broken</span>}
          </div>
        )}
        </div>
      </div>
      <p className={`chart-note ${flaggedIds.length ? 'flagged' : 'clean'}`}>
        {flaggedIds.length
          ? `Red diamonds break a rule: ${flaggedIds.join(', ')}.`
          : 'No build breaks a rule on this chart.'}
      </p>
      {flaggedIds.length > 0 && (
        <ul className="rule-list" aria-label="Rules broken on this chart">
          {rulesBroken(rules, buildIds).map(({ rule, builds }) => (
            <li key={rule}>
              <strong>Rule {rule}:</strong> {rulePhrase(rule, kind)} (Builds: {builds.map((b, k) => <span key={b}><span className="nb">{b}</span>{k < builds.length - 1 ? ', ' : ''}</span>)})
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}

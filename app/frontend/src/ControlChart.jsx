import { chartDomain, makeScale, specVisible, extent, xPosition } from './scale.js'
import { fmt, shortBuild } from './format.js'

// One control chart drawn as inline SVG. Every number (centre line, limits, points, which rules
// fired) is passed in from the API; this component only turns them into pixels.
//
// props:
//   title, unit      text for the heading and the y axis
//   buildIds         x labels, one per point
//   values           the plotted points (null = no point, used by the MR chart)
//   cl, ucl, lcl     lines from the API
//   rules            for each point, the list of rule numbers it broke ([] = none)
//   specs            [{label, value}] spec lines (dashed); only drawn when near the data
//   baselineN        how many first builds were used for the limits (shaded)
//   digits           decimals for labels

const W = 560
const H = 250
const M = { left: 56, right: 86, top: 24, bottom: 34 }

const NOT_FLAGGED_COLOR = '#1d4ed8'
const FLAGGED_COLOR = '#b42318'

export default function ControlChart({
  title, unit, buildIds, values, cl, ucl, lcl, rules, specs = [], baselineN, digits = 2,
}) {
  const n = values.length
  const left = M.left
  const right = W - M.right
  const top = M.top
  const bottom = H - M.bottom

  const limits = [cl, ucl, lcl]
  const domain = chartDomain(values, limits, specs.map((s) => s.value))
  const y = makeScale(domain[0], domain[1], bottom, top)
  const x = (i) => xPosition(i, n, left, right)
  const step = n > 1 ? (right - left) / (n - 1) : 0

  const dataDomain = extent([...values, ...limits])
  const shownSpecs = specs.filter((s) => specVisible(s.value, dataDomain))
  const hiddenSpecs = specs.filter((s) => s.value !== null && s.value !== undefined && !specVisible(s.value, dataDomain))

  const flaggedIds = buildIds.filter((_, i) => rules[i] && rules[i].length > 0)

  // points joined by a line (skip null values)
  const path = values
    .map((v, i) => (v === null || v === undefined ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .join(' ')

  const lines = [
    { label: 'UCL', value: ucl, color: FLAGGED_COLOR, dash: null },
    { label: 'CL', value: cl, color: '#067647', dash: null },
    { label: 'LCL', value: lcl, color: FLAGGED_COLOR, dash: null },
  ]

  const ticks = buildIds.map((id, i) => ({ id, i })).filter(({ i }) => i % 5 === 0 || i === n - 1)

  const baselineRight = baselineN ? x(Math.min(baselineN, n) - 1) + step / 2 : null

  return (
    <figure className="chart">
      <figcaption>
        <strong>{title}</strong> {unit ? <span className="muted">({unit})</span> : null}
      </figcaption>
      <div className="chart-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={`${title}. ${flaggedIds.length ? `Out of control: ${flaggedIds.join(', ')}.` : 'No build breaks a rule.'}`}
        >
          {baselineRight !== null && (
            <g>
              <rect x={left - step / 2} y={top} width={baselineRight - left + step / 2} height={bottom - top} fill="#e0ecff" />
              <text x={left - step / 2 + 4} y={top + 12} fontSize="12" fill="#334155">
                {`baseline (builds 1-${Math.min(baselineN, n)})`}
              </text>
            </g>
          )}

          <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#64748b" />
          <line x1={left} y1={top} x2={left} y2={bottom} stroke="#64748b" />
          <text x={left - 6} y={top + 4} fontSize="12" textAnchor="end" fill="#334155">{fmt(domain[1], digits)}</text>
          <text x={left - 6} y={bottom} fontSize="12" textAnchor="end" fill="#334155">{fmt(domain[0], digits)}</text>
          {ticks.map(({ id, i }) => (
            <text key={id} x={x(i)} y={bottom + 16} fontSize="12" textAnchor="middle" fill="#334155">{shortBuild(id)}</text>
          ))}
          <text x={(left + right) / 2} y={H - 4} fontSize="12" textAnchor="middle" fill="#334155">build</text>

          {lines.map((l) => (
            <g key={l.label}>
              <line x1={left} y1={y(l.value)} x2={right} y2={y(l.value)} stroke={l.color} strokeWidth="1.5" />
              <text x={right + 4} y={y(l.value) + 4} fontSize="12" fill={l.color}>{`${l.label} ${fmt(l.value, digits)}`}</text>
            </g>
          ))}

          {shownSpecs.map((s) => (
            <g key={s.label}>
              <line x1={left} y1={y(s.value)} x2={right} y2={y(s.value)} stroke="#6d28d9" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x={right + 4} y={y(s.value) + 4} fontSize="12" fill="#6d28d9">{`${s.label} ${fmt(s.value, digits)}`}</text>
            </g>
          ))}

          <polyline points={path} fill="none" stroke={NOT_FLAGGED_COLOR} strokeWidth="1.5" />

          {values.map((v, i) => {
            if (v === null || v === undefined) return null
            const broke = rules[i] && rules[i].length > 0
            const tip = `${buildIds[i]}: ${fmt(v, digits)}${unit ? ' ' + unit : ''}\n${broke ? 'Rules broken: ' + rules[i].join(', ') : 'No rule broken'}`
            const cx = x(i)
            const cy = y(v)
            return broke ? (
              <polygon
                key={i}
                points={`${cx},${cy - 7} ${cx + 7},${cy} ${cx},${cy + 7} ${cx - 7},${cy}`}
                fill={FLAGGED_COLOR}
                stroke="#fff"
                strokeWidth="1"
              >
                <title>{tip}</title>
              </polygon>
            ) : (
              <circle key={i} cx={cx} cy={cy} r="3.5" fill={NOT_FLAGGED_COLOR}>
                <title>{tip}</title>
              </circle>
            )
          })}
        </svg>
      </div>
      <p className="chart-note">
        {flaggedIds.length
          ? `Red diamonds break a rule: ${flaggedIds.join(', ')}.`
          : 'No build breaks a rule on this chart.'}
        {hiddenSpecs.length > 0 &&
          ` Spec limit${hiddenSpecs.length > 1 ? 's' : ''} not drawn (far outside the data): ${hiddenSpecs
            .map((s) => `${s.label} ${fmt(s.value, digits)}`)
            .join(', ')}.`}
      </p>
    </figure>
  )
}

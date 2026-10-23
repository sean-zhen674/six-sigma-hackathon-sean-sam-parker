import { chartDomain, makeScale, specVisible, extent, spreadLabels, xPosition } from './scale.js'
import { CHART_HELP, fmt, ruleTip, shortBuild, specTag } from './format.js'

/** The one-line plain description under a chart title. kind = 'xbar' | 'r' | 'i' | 'mr'. */
export function ChartHelp({ kind }) {
  return CHART_HELP[kind] ? <p className="chart-help">{CHART_HELP[kind]}</p> : null
}

// One control chart drawn as inline SVG. Every number (centre line, limits, points, which rules
// fired) is passed in from the API; this component only turns them into pixels.
//
// props:
//   title, unit      text for the heading (it already names the unit) and for the hover text; unit is in words
//   kind             'xbar' | 'r' | 'i' | 'mr': picks the one-line help text under the title
//   buildIds         x labels, one per point
//   values           the plotted points (null = no point, used by the MR chart)
//   cl, ucl, lcl     lines from the API
//   rules            for each point, the list of rule numbers it broke ([] = none)
//   specs            [{label, value}] spec lines (dashed); only drawn when near the data
//   baselineN        how many first builds were used for the limits (shaded)
//   digits           decimals for labels

const W = 560
const H = 258
const M = { left: 56, right: 104, top: 24, bottom: 42 }

const NOT_FLAGGED_COLOR = '#1d4ed8'
const FLAGGED_COLOR = '#b42318'

export default function ControlChart({
  title, kind, unit, buildIds, values, cl, ucl, lcl, rules, specs = [], baselineN, digits = 2,
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

  // Three control lines (tag drawn in the chart, full name in the legend under the chart).
  const lines = [
    { tag: 'Upper', full: 'Upper control limit', value: ucl, color: FLAGGED_COLOR },
    { tag: 'Center', full: 'Center line', value: cl, color: '#067647' },
    { tag: 'Lower', full: 'Lower control limit', value: lcl, color: FLAGGED_COLOR },
  ]
  // Every label on the right edge: control lines are one text line, allowed-value lines are two.
  const labels = [
    ...lines.map((l) => ({ text: [`${l.tag} ${fmt(l.value, digits)}`], color: l.color, value: l.value, h: 17 })),
    ...shownSpecs.map((s) => ({ text: [specTag(s.label), fmt(s.value, digits)], color: '#6d28d9', value: s.value, h: 32 })),
  ]
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
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={`${title}. ${baselineRight !== null ? `Shaded area: Baseline builds 1 to ${Math.min(baselineN, n)}. ` : ''}${flaggedIds.length ? `Out of control: ${flaggedIds.join(', ')}.` : 'No build breaks a rule.'}`}
        >
          {baselineRight !== null && (
            <g>
              <rect x={baselineLeft} y={top} width={baselineRight - baselineLeft} height={bottom - top} fill="#e0ecff" />
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
            <line key={l.full} x1={left} y1={y(l.value)} x2={right} y2={y(l.value)} stroke={l.color} strokeWidth="1.5" />
          ))}
          {shownSpecs.map((s) => (
            <line key={s.label} x1={left} y1={y(s.value)} x2={right} y2={y(s.value)} stroke="#6d28d9" strokeWidth="1.5" strokeDasharray="6 4" />
          ))}
          {labels.map((l, k) => (
            <text key={k} x={right + 6} fontSize="12" fill={l.color}>
              {l.text.map((line, j) => (
                <tspan key={j} x={right + 6} y={labelY[k] - (l.text.length - 1) * 7 + j * 14 + 4}>{line}</tspan>
              ))}
            </text>
          ))}

          <polyline points={path} fill="none" stroke={NOT_FLAGGED_COLOR} strokeWidth="1.5" />

          {values.map((v, i) => {
            if (v === null || v === undefined) return null
            const broke = rules[i] && rules[i].length > 0
            const tip = `${buildIds[i]}: ${fmt(v, digits)}${unit ? ' ' + unit : ''}\n${broke ? 'Rules broken:\n' + rules[i].map((r) => '- ' + ruleTip(r, kind)).join('\n') : 'No rule broken'}`
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
      <ul className="chart-legend" aria-label="What the lines show">
        {lines.map((l) => (
          <li key={l.full}><span className="swatch" style={{ borderColor: l.color }} aria-hidden="true" />{l.full}: {fmt(l.value, digits)}</li>
        ))}
        {shownSpecs.map((s) => (
          <li key={s.label}><span className="swatch dashed" style={{ borderColor: '#6d28d9' }} aria-hidden="true" />{s.label}: {fmt(s.value, digits)}</li>
        ))}
      </ul>
      <p className="chart-note">
        {flaggedIds.length
          ? `Red diamonds break a rule: ${flaggedIds.join(', ')}.`
          : 'No build breaks a rule on this chart.'}
        {hiddenSpecs.length > 0 &&
          ` Not drawn because far outside the data: ${hiddenSpecs
            .map((s) => `${s.label.toLowerCase()} ${fmt(s.value, digits)}`)
            .join(', ')}.`}
      </p>
    </figure>
  )
}

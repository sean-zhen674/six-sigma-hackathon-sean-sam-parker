import { useState } from 'react'
import { plotCaption, plotSummary, pointTip } from './causes.js'
import { fmt } from './format.js'
import { TEXT } from './labels.js'
import { chartDomain, makeScale, niceTicks, spreadLabels, xPosition } from './scale.js'

// An interaction plot drawn as inline SVG, in the style of ControlChart and Histogram.
// x axis: the levels of one factor (the material lots). One line per machine. Each point is the
// average of the build averages for that machine and lot, with a bar of one standard error.
// Every number comes from the API (see causes.js plotModel); this file only turns them into pixels.
//
// Colour is never the only signal: each line has its own marker shape and dash pattern, and its
// name is written at the end of the line.
//
// props:
//   q      one entry of QUALITY (title, unit, digits)
//   model  the result of plotModel(q, metric, factors)

const W = 560
const H = 300
const M = { left: 64, right: 104, top: 16, bottom: 58 }
const COLORS = ['#1d4ed8', '#b45309', '#7e22ce', '#0f766e']
const DASHES = [null, '7 4', '2 4', '8 3 2 3']
const OFFSET = 7 // lines that share an x position are moved apart a little so their bars do not overlap

function Marker({ shape, x, y, color, big }) {
  const r = big ? 7 : 5
  if (shape === 0) return <circle cx={x} cy={y} r={r} fill={color} stroke="#fff" strokeWidth="1.5" />
  if (shape === 1) return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={color} stroke="#fff" strokeWidth="1.5" />
  if (shape === 2) return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} fill={color} stroke="#fff" strokeWidth="1.5" />
  return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} fill={color} stroke="#fff" strokeWidth="1.5" />
}

export default function InteractionPlot({ q, model }) {
  const [hover, setHover] = useState(null) // { s, i } of the point being pointed at (hover, or tap on a phone)
  const digits = q.digits + 1
  const unit = q.unit ? ` ${q.unit}` : ''
  const left = M.left
  const right = W - M.right
  const top = M.top
  const bottom = H - M.bottom
  const count = model.series.length
  const n = model.xLevels.length

  const domain = chartDomain([model.lo, model.hi], [])
  const y = makeScale(domain[0], domain[1], bottom, top)
  const ticks = niceTicks(domain[0], domain[1], 5)
  const x = (i, s) => xPosition(i, n, left + 34, right - 34) + (s - (count - 1) / 2) * (count > 1 ? OFFSET : 0)
  const rotate = n > 4

  // names at the end of each line, kept apart
  const ends = model.series.map((s, k) => {
    let last = -1
    s.points.forEach((p, i) => { if (p) last = i })
    return last < 0 ? null : { k, x: x(last, k) + 12, y: y(s.points[last].mean) }
  })
  const present = ends.filter(Boolean)
  const labelY = spreadLabels(present.map((e) => ({ y: e.y, h: 16 })), top + 6, bottom - 4)

  const tip = hover && model.series[hover.s] ? model.series[hover.s].points[hover.i] ?? null : null
  const tipX = tip ? x(hover.i, hover.s) : 0
  const tipY = tip ? y(tip.mean) : 0

  return (
    <figure className="chart interaction-plot">
      <figcaption><strong>{q.title}: {TEXT.causes.plotTitle}{q.unit ? ` (${q.unit})` : ''}</strong></figcaption>
      <div className="chart-scroll">
        <div className="chart-plot">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={plotSummary(q, model)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} y1={y(t)} x2={right} y2={y(t)} stroke="#e2e8f0" />
                <text x={left - 6} y={y(t) + 4} fontSize="12" textAnchor="end" fill="#475569">{fmt(t, digits)}</text>
              </g>
            ))}
            <line x1={left} y1={top} x2={left} y2={bottom} stroke="#64748b" />
            <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#64748b" />
            {model.xLevels.map((level, i) => {
              const lx = x(i, (count - 1) / 2)
              return (
                <g key={level}>
                  <line x1={lx} y1={bottom} x2={lx} y2={bottom + 4} stroke="#64748b" />
                  <text x={lx} y={bottom + 18} fontSize="12" fill="#334155" textAnchor={rotate ? 'end' : 'middle'}
                    transform={rotate ? `rotate(-30 ${lx} ${bottom + 18})` : undefined}>{level}</text>
                </g>
              )
            })}
            <text x={(left + right) / 2} y={H - 4} fontSize="12" fontWeight="600" textAnchor="middle" fill="#334155">{model.xLabel}</text>

            {model.series.map((s, k) => {
              const color = COLORS[k % COLORS.length]
              // a missing combination breaks the line: draw one piece for each run of points
              const runs = []
              let run = []
              s.points.forEach((p, i) => {
                if (p) run.push(`${x(i, k)},${y(p.mean)}`)
                else if (run.length) { runs.push(run); run = [] }
              })
              if (run.length) runs.push(run)
              return (
                <g key={s.name}>
                  {runs.map((r, j) => r.length > 1 && (
                    <polyline key={j} points={r.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={DASHES[k % DASHES.length] ?? undefined} />
                  ))}
                  {s.points.map((p, i) => p && p.se !== null && (
                    <g key={`bar-${i}`} stroke={color} strokeWidth="1.5">
                      <line x1={x(i, k)} y1={y(p.mean - p.se)} x2={x(i, k)} y2={y(p.mean + p.se)} />
                      <line x1={x(i, k) - 4} y1={y(p.mean - p.se)} x2={x(i, k) + 4} y2={y(p.mean - p.se)} />
                      <line x1={x(i, k) - 4} y1={y(p.mean + p.se)} x2={x(i, k) + 4} y2={y(p.mean + p.se)} />
                    </g>
                  ))}
                  {s.points.map((p, i) => p && (
                    <g key={`pt-${i}`}>
                      <Marker shape={k % 4} x={x(i, k)} y={y(p.mean)} color={color} big={hover && hover.s === k && hover.i === i} />
                      <circle cx={x(i, k)} cy={y(p.mean)} r="13" fill="transparent"
                        onMouseEnter={() => setHover({ s: k, i })} onMouseLeave={() => setHover(null)}
                        onClick={() => setHover(hover && hover.s === k && hover.i === i ? null : { s: k, i })} />
                    </g>
                  ))}
                </g>
              )
            })}

            {model.showSeries && present.map((e, j) => (
              <text key={model.series[e.k].name} x={e.x} y={labelY[j] + 4} fontSize="12" fontWeight="700" fill={COLORS[e.k % COLORS.length]} pointerEvents="none">
                {model.series[e.k].name}
              </text>
            ))}
          </svg>
          {tip && (
            <div
              className={`chart-tip${tipX > (left + right) / 2 ? ' left' : ''}${tipX < left + (right - left) * 0.3 ? ' start' : ''}${tipY < H * 0.45 ? ' below' : ''}`}
              style={{ left: `${(tipX / W) * 100}%`, top: `${(tipY / H) * 100}%` }}
              role="status"
            >
              <span>{pointTip(q, model.series[hover.s].name, model.xLevels[hover.i], { mean: tip.mean, n: tip.n }, model.showSeries)}</span>
            </div>
          )}
        </div>
      </div>
      {model.showSeries && (
        <ul className="plot-key" aria-hidden="true">
          {model.series.map((s, k) => (
            <li key={s.name}>
              <svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true">
                <line x1="2" y1="7" x2="42" y2="7" stroke={COLORS[k % COLORS.length]} strokeWidth="2.5" strokeDasharray={DASHES[k % DASHES.length] ?? undefined} />
                <Marker shape={k % 4} x={22} y={7} color={COLORS[k % COLORS.length]} />
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <p className="chart-note">{plotCaption(model)}</p>
      <div className="sr-only"><table>
        <caption>{q.title}: Average of the build averages for each {model.showSeries ? 'machine and ' : ''}{model.xLabel.toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">{model.showSeries ? 'Machine' : 'Group'}</th>
            {model.xLevels.map((l) => <th key={l} scope="col">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {model.series.map((s) => (
            <tr key={s.name}>
              <th scope="row">{s.name}</th>
              {s.points.map((p, i) => (
                <td key={i}>{p ? `${fmt(p.mean, digits)}${unit}${p.n ? ` (${p.n} ${p.n === 1 ? 'build' : 'builds'})` : ''}` : 'No builds'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  )
}

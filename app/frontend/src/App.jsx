import { useEffect, useRef, useState } from 'react'
import { analyzeDataset, analyzeUpload, fetchDatasets, fetchSpecLimits } from './api.js'
import ControlChart from './ControlChart.jsx'
import {
  capabilityRow, fmt, fmtTime, iProps, mrProps, rProps, suspectText, xbarProps,
} from './format.js'

// Everything shown here comes from the API response. This file only lays it out.

const QUALITY = [
  { key: 'uts_MPa', title: 'UTS', unit: 'MPa', digits: 1, index: 'cpl', indexName: 'Cpl (UTS, lower spec)' },
  { key: 'porosity_pct', title: 'Porosity', unit: '%', digits: 3, index: 'cpu', indexName: 'Cpu (porosity, upper spec)' },
  { key: 'dimensional_dev_mm', title: 'Dimensional deviation', unit: 'mm', digits: 3, index: 'cpk', indexName: 'Cpk (dimensional, two-sided)' },
]

const PARAMS = {
  chamber_oxygen_ppm: { title: 'Chamber oxygen', unit: 'ppm', digits: 1 },
  laser_power_W: { title: 'Laser power', unit: 'W', digits: 1 },
  scan_speed_mm_s: { title: 'Scan speed', unit: 'mm/s', digits: 1 },
  layer_thickness_um: { title: 'Layer thickness', unit: 'µm', digits: 2 },
  humidity_pct: { title: 'Humidity', unit: '%', digits: 1 },
  powder_bed_temp_C: { title: 'Powder bed temperature', unit: '°C', digits: 1 },
  build_plate_temp_C: { title: 'Build plate temperature', unit: '°C', digits: 1 },
  stress_relief_temp_C: { title: 'Stress relief temperature', unit: '°C', digits: 1 },
}
const MAIN_PARAMS = ['chamber_oxygen_ppm', 'laser_power_W']

const SPEC_FIELDS = [
  { name: 'uts_lsl', label: 'UTS LSL (MPa)', from: ['uts_MPa', 'lsl'] },
  { name: 'porosity_usl', label: 'Porosity USL (%)', from: ['porosity_pct', 'usl'] },
  { name: 'dim_lsl', label: 'Dimensional LSL (mm)', from: ['dimensional_dev_mm', 'lsl'] },
  { name: 'dim_usl', label: 'Dimensional USL (mm)', from: ['dimensional_dev_mm', 'usl'] },
]

const RULES = [
  [1, 'One point beyond 3 sigma (a sudden jump).'],
  [2, 'Nine in a row on the same side of the centre line (a small steady shift).'],
  [3, 'Six in a row steadily rising or falling (a drift).'],
  [4, 'Fourteen in a row alternating up and down (two things taking turns).'],
  [5, 'Two of three in a row beyond 2 sigma on the same side.'],
  [6, 'Four of five in a row beyond 1 sigma on the same side.'],
  [7, 'Fifteen in a row within 1 sigma of the centre (suspiciously flat).'],
  [8, 'Eight in a row beyond 1 sigma on either side (none near the centre).'],
]

function specLines(spec) {
  if (!spec) return []
  return [
    { label: 'LSL', value: spec.lsl },
    { label: 'USL', value: spec.usl },
  ].filter((s) => s.value !== null && s.value !== undefined)
}

export default function App() {
  const [datasets, setDatasets] = useState([])
  const [dataset, setDataset] = useState('capable_baseline')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0) // changing it empties the file input
  const [baselineN, setBaselineN] = useState(20)
  const [specs, setSpecs] = useState({ uts_lsl: '', porosity_usl: '', dim_lsl: '', dim_usl: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const latest = useRef(0) // ignore answers that arrive after a newer request

  async function run(nextFile, nextDataset, nextSpecs = specs) {
    const id = ++latest.current
    setLoading(true)
    setError(null)
    try {
      const data = nextFile
        ? await analyzeUpload(nextFile, baselineN, nextSpecs)
        : await analyzeDataset(nextDataset, baselineN)
      if (id === latest.current) setResult(data)
    } catch (err) {
      if (id === latest.current) {
        setResult(null)
        setError(err.message)
      }
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }

  useEffect(() => {
    async function start() {
      try {
        const [list, limits] = await Promise.all([fetchDatasets(), fetchSpecLimits()])
        setDatasets(list.datasets)
        const filled = {}
        for (const f of SPEC_FIELDS) filled[f.name] = String(limits.specs[f.from[0]][f.from[1]] ?? '')
        setSpecs(filled)
      } catch (err) {
        setError(err.message)
        return
      }
      run(null, 'capable_baseline')
    }
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onDataset(e) {
    setDataset(e.target.value)
    setFile(null)
    setFileKey((k) => k + 1)
    run(null, e.target.value)
  }

  function onFile(e) {
    const picked = e.target.files[0] || null
    setFile(picked)
    if (picked) run(picked, dataset)
  }

  function onSubmit(e) {
    e.preventDefault()
    run(file, dataset)
  }

  return (
    <>
      <header className="site-header">
        <h1>AeroPrint</h1>
        <p>Is the titanium-bracket print process in control and capable of the aerospace spec, since which build did it stop, and what should we do with each build?</p>
      </header>

      <main>
        <form className="controls" onSubmit={onSubmit} aria-label="Data and settings">
          <div className="field">
            <label htmlFor="dataset">Test dataset</label>
            <select id="dataset" value={dataset} onChange={onDataset}>
              {datasets.length === 0 && <option value={dataset}>{dataset}</option>}
              {datasets.map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="csv">Use my own CSV</label>
            <input id="csv" key={fileKey} type="file" accept=".csv,text/csv" onChange={onFile} />
          </div>
          <div className="field">
            <label htmlFor="baseline">Baseline builds (min 5)</label>
            <input id="baseline" type="number" min="5" step="1" value={baselineN}
              onChange={(e) => setBaselineN(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          {SPEC_FIELDS.map((f) => (
            <div className="field" key={f.name}>
              <label htmlFor={f.name}>{f.label}</label>
              <input id={f.name} type="number" step="any" value={specs[f.name]} disabled={!file}
                onChange={(e) => setSpecs({ ...specs, [f.name]: e.target.value })} />
            </div>
          ))}
          <div className="field">
            <button type="submit" disabled={loading || baselineN === '' || baselineN < 5}>Run again</button>
          </div>
          <p className="hint">
            {file ? `Using your file: ${file.name}. ` : 'Spec limits can be changed when you upload your own CSV. '}
            Limits are computed from the first {baselineN || '...'} builds.
          </p>
        </form>

        <div aria-live="polite">
          {loading && <p className="status">Loading analysis...</p>}
          {error && <p className="error" role="alert"><strong>Could not analyze:</strong> {error}</p>}
        </div>

        {result && <Results result={result} />}
        <Legend />
      </main>
    </>
  )
}

function Results({ result }) {
  const cap = result.capability
  const capable = result.process_capable
  const first = result.first_out_of_control_build
  const threshold = result.settings.capable_min_index
  const baselineUsed = result.settings.baseline_n_used

  return (
    <>
      <section className={`banner ${capable ? 'yes' : 'no'}`} aria-labelledby="banner-h">
        <h2 id="banner-h">
          <span aria-hidden="true">{capable ? '✔' : '✖'}</span>{' '}
          Process capable: {capable ? 'YES' : 'NO'}
        </h2>
        <p className="first-ooc">
          First out-of-control build: <strong>{first ?? 'none'}</strong>
        </p>
        <ul className="indices">
          {QUALITY.map((q) => {
            const row = capabilityRow(cap[q.key], q.index)
            return (
              <li key={q.key}>
                <span className="index-name">{q.indexName}</span>
                <span className="index-value">{row.text}</span>
                <span className="index-meta">
                  {row.reliableLabel}; needs at least {fmt(threshold, 2)}
                  {row.message ? `. ${row.message}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="how">
          How to read this: a red point means that build behaved differently from the baseline builds;
          an index of {fmt(threshold, 2)} or more means the process meets spec with margin, and it only counts while the chart is in control.
        </p>
        {result.warnings.length > 0 && (
          <details>
            <summary>Notes from the analysis ({result.warnings.length})</summary>
            <ul>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}
      </section>

      <section aria-labelledby="charts-h">
        <h2 id="charts-h">Control charts</h2>
        <p className="muted">Blue shading = baseline builds used for the limits. Red diamond = a rule was broken (hover for the build and rules).</p>
        {QUALITY.filter((q) => q.key !== 'dimensional_dev_mm').map((q) => (
          <QualityCharts key={q.key} q={q} result={result} baselineUsed={baselineUsed} />
        ))}
        <details>
          <summary>Dimensional deviation X-bar and R charts</summary>
          <QualityCharts q={QUALITY[2]} result={result} baselineUsed={baselineUsed} />
        </details>

        <h2>Build parameters (I-MR charts)</h2>
        {MAIN_PARAMS.map((name) => (
          <ParamCharts key={name} name={name} p={result.charts.imr[name]} ids={result.build_ids} baselineUsed={baselineUsed} withMr />
        ))}
        <details>
          <summary>Other build parameters (I charts)</summary>
          {Object.keys(result.charts.imr).filter((n) => !MAIN_PARAMS.includes(n)).map((name) => (
            <ParamCharts key={name} name={name} p={result.charts.imr[name]} ids={result.build_ids} baselineUsed={baselineUsed} />
          ))}
        </details>
      </section>

      <BuildTable builds={result.builds} />
    </>
  )
}

function QualityCharts({ q, result, baselineUsed }) {
  const chart = result.charts[q.key]
  const ids = chart.build_ids
  const spec = specLines(result.settings.specs[q.key])
  return (
    <div className="chart-pair">
      <ControlChart title={`${q.title} X-bar chart`} unit={q.unit} buildIds={ids} baselineN={baselineUsed}
        digits={q.digits} {...xbarProps(chart, spec)} />
      <ControlChart title={`${q.title} R chart`} unit={q.unit} buildIds={ids} baselineN={baselineUsed}
        digits={q.digits} {...rProps(chart)} />
    </div>
  )
}

function ParamCharts({ name, p, ids, baselineUsed, withMr }) {
  const meta = PARAMS[name] || { title: name, unit: '', digits: 2 }
  return (
    <div className="chart-pair">
      <ControlChart title={`${meta.title} I chart`} unit={meta.unit} buildIds={ids} baselineN={baselineUsed}
        digits={meta.digits} {...iProps(p)} />
      {withMr && (
        <ControlChart title={`${meta.title} moving range`} unit={meta.unit} buildIds={ids} baselineN={baselineUsed}
          digits={meta.digits} {...mrProps(p)} />
      )}
    </div>
  )
}

const BADGE_ICON = { RELEASE: '✔', RETEST: '▲', QUARANTINE: '✖' }

function BuildTable({ builds }) {
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const rows = onlyFlagged ? builds.filter((b) => b.disposition !== 'RELEASE') : builds
  return (
    <section aria-labelledby="table-h">
      <h2 id="table-h">Builds</h2>
      <label className="toggle">
        <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
        Show only flagged builds (RETEST or QUARANTINE)
      </label>
      <p className="muted">{rows.length} of {builds.length} builds shown.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Build</th>
              <th scope="col">Timestamp</th>
              <th scope="col">Disposition</th>
              <th scope="col">Rules broken</th>
              <th scope="col">Investigate first</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.build_id} data-disposition={b.disposition}>
                <th scope="row">{b.build_id}</th>
                <td>{fmtTime(b.timestamp)}</td>
                <td>
                  <span className={`badge ${b.disposition.toLowerCase()}`}>
                    <span aria-hidden="true">{BADGE_ICON[b.disposition]}</span> {b.disposition}
                  </span>
                  {b.any_coupon_out_of_spec && <div className="muted">a coupon is out of spec</div>}
                </td>
                <td>{b.rules_broken.length ? b.rules_broken.join('; ') : '-'}</td>
                <td>{suspectText(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Legend() {
  return (
    <section aria-labelledby="legend-h" className="legend">
      <h2 id="legend-h">What the rules mean</h2>
      <p>Each rule looks for a pattern that is unlikely when the process only has its usual random variation. The X-bar and I charts use all eight rules; the R and moving-range charts use rule 1 only.</p>
      <ol>
        {RULES.map(([n, text]) => <li key={n} value={n}><strong>Rule {n}.</strong> {text}</li>)}
      </ol>
      <p><strong>Disposition.</strong></p>
      <ul>
        <li><strong>QUARANTINE</strong>: the build broke a rule on the UTS or porosity X-bar or R chart.</li>
        <li><strong>RETEST</strong>: the charts are in control for this build, but at least one coupon is outside the spec.</li>
        <li><strong>RELEASE</strong>: neither of the above.</li>
      </ul>
      <p className="muted">With eight rules running on many charts, an occasional chance alarm is expected even when nothing is wrong. Look for a build where several rules and several charts agree.</p>
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import { analyzeDataset, analyzeUpload, fetchDatasets, fetchSpecLimits } from './api.js'
import ControlChart from './ControlChart.jsx'
import CsvHelp from './CsvHelp.jsx'
import Tour from './Tour.jsx'
import {
  BASELINE_MIN, DEFAULT_BASELINE, isNarrowScreen, DIM_GROUP, REPO_URL, SPEC_FIELDS, UNRELIABLE_TEXT, baselineChange, capabilityRow, chartTitle, datasetLabel, datasetText, explainRule, explainUploadError, fmt, fmtTime,
  iProps, mrProps, plainNote, rProps, specDefaults, suspectText, summarySentence, validateSpecs, xbarProps,
} from './format.js'
import { LEGEND_RULES, MAIN_PARAMS, PARAMS, QUALITY, TEXT } from './labels.js'
import { markTourSeen, tourSeen } from './tour.js'

// Everything shown here comes from the analysis service's answer. This file only lays it out.
// The words themselves live in labels.js and format.js.

/** The service's description of the selected dataset ('' until the list has loaded). */
function describe(datasets, name) {
  const found = datasets.find((d) => d.name === name)
  return found ? found.description : ''
}

export default function App() {
  const [datasets, setDatasets] = useState([])
  const [dataset, setDataset] = useState('capable_baseline')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0) // changing it empties the file input
  const [baselineN, setBaselineN] = useState(DEFAULT_BASELINE) // what is in the Baseline builds box (shared by every button)
  const [appliedBaseline, setAppliedBaseline] = useState(DEFAULT_BASELINE) // the value of the last request
  const [baselineError, setBaselineError] = useState(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [defaults, setDefaults] = useState({ uts_lsl: '', porosity_usl: '', dim_lsl: '', dim_usl: '' })
  const [specs, setSpecs] = useState(defaults)
  const [specError, setSpecError] = useState(null) // a problem in the allowed-value boxes: no request is sent
  const [tourOpen, setTourOpen] = useState(() => !tourSeen())
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [narrow, setNarrow] = useState(() => isNarrowScreen(window.innerWidth)) // window too narrow for readable charts
  const latest = useRef(0) // ignore answers that arrive after a newer request

  function closeTour() {
    markTourSeen()
    setTourOpen(false)
  }

  // Only one popup at a time: opening one closes the other.
  function openTour() {
    setCsvOpen(false)
    setTourOpen(true)
  }
  function changeCsvOpen(open) {
    if (open) {
      markTourSeen()
      setTourOpen(false)
    }
    setCsvOpen(open)
  }

  async function run(nextFile, nextDataset, nextSpecs = specs, nextBaseline = baselineN) {
    const check = validateSpecs(nextSpecs)
    if (!check.ok) {
      setSpecError(check.message)
      return
    }
    setSpecError(null)
    const baseCheck = baselineChange(nextBaseline, null)
    if (baseCheck.kind === 'invalid') {
      setBaselineError(baseCheck.message) // the Baseline builds box needs fixing first: no request is sent
      return
    }
    setBaselineError(null)
    setAppliedBaseline(Number(nextBaseline))
    const id = ++latest.current
    setLoading(true)
    setError(null)
    try {
      const data = nextFile
        ? await analyzeUpload(nextFile, nextBaseline, nextSpecs)
        : await analyzeDataset(nextDataset, nextBaseline, nextSpecs)
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
    const onResize = () => setNarrow(isNarrowScreen(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    async function start() {
      try {
        const [list, limits] = await Promise.all([fetchDatasets(), fetchSpecLimits()])
        setDatasets(list.datasets)
        const filled = specDefaults(limits)
        setDefaults(filled)
        setSpecs(filled)
        run(null, 'capable_baseline', filled)
      } catch (err) {
        setError(err.message)
      }
    }
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onDataset(e) {
    setDataset(e.target.value)
    setFile(null)
    setFileKey((k) => k + 1)
    setSpecs(defaults) // a new dataset starts from the default limits
    run(null, e.target.value, defaults)
  }

  function onReset() {
    setSpecs(defaults)
    setSpecError(null)
    setBaselineN(DEFAULT_BASELINE)
    setBaselineError(null)
    run(file, dataset, defaults, DEFAULT_BASELINE)
  }

  // Enter, leaving the box and the Update charts button all come here. Bad or unchanged values send nothing.
  function applyBaseline() {
    const change = baselineChange(baselineN, appliedBaseline)
    if (change.kind === 'invalid') {
      setBaselineError(change.message)
      return
    }
    setBaselineError(null)
    if (change.kind === 'apply') run(file, dataset, specs, change.value)
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
        <div className="header-row">
          <h1>AeroPrint</h1>
          <div className="header-actions">
            <a className="repo-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {TEXT.githubLabel}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button type="button" className="tour-open" onClick={openTour}>Take the tour</button>
          </div>
        </div>
      </header>

      {tourOpen && <Tour onClose={closeTour} />}

      <main>
        {narrow && (<p className="narrow-warning" role="note"><span aria-hidden="true">⚠</span> {TEXT.narrowScreen}</p>)}
        <form className="controls" onSubmit={onSubmit} aria-label="Data and parameters">
          <section className="card" aria-labelledby="dataset-h">
            <h2 id="dataset-h" className="card-title">{TEXT.datasetHeading}</h2>
            <div className="field">
              <label htmlFor="dataset">{TEXT.datasetLabel}</label>
              <select id="dataset" value={dataset} onChange={onDataset} aria-describedby="dataset-desc">
                {datasets.length === 0 && <option value={dataset}>{datasetLabel(dataset)}</option>}
                {datasets.map((d) => (
                  <option key={d.name} value={d.name}>{datasetLabel(d.name)}</option>
                ))}
              </select>
              <p id="dataset-desc" className="dataset-desc">
                {file
                  ? `Analyzing your file ${file.name} instead of ${datasetLabel(dataset)}.`
                  : datasetText(dataset, describe(datasets, dataset))}
              </p>
            </div>
            <div className="field">
              <label htmlFor="csv">{TEXT.fileLabel}</label>
              <input id="csv" key={fileKey} type="file" accept=".csv,text/csv" onChange={onFile} />
              {file && <p className="hint">Using your file: {file.name}.</p>}
              <CsvHelp open={csvOpen} onOpenChange={changeCsvOpen} />
            </div>
          </section>

          <section className="card" aria-labelledby="parameters-h">
            <h2 id="parameters-h" className="card-title">{TEXT.parametersHeading}</h2>
            {SPEC_FIELDS.filter((f) => !f.group).map((f) => (
              <div className="field" key={f.name}>
                <label htmlFor={f.name}>{f.label}</label>
                <input id={f.name} type="number" step="any" value={specs[f.name]}
                  onChange={(e) => setSpecs({ ...specs, [f.name]: e.target.value })} />
              </div>
            ))}
            <div className="field-group">
              <p className="group-heading" aria-hidden="true">{DIM_GROUP}</p>
              <div className="field-row">
                {SPEC_FIELDS.filter((f) => f.group).map((f) => (
                  <div className="field" key={f.name}>
                    <label htmlFor={f.name}>
                      <span className="sr-only">{f.group}: </span>{f.short}
                    </label>
                    <input id={f.name} type="number" step="any" value={specs[f.name]}
                      onChange={(e) => setSpecs({ ...specs, [f.name]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="button-row">
              <button type="submit" disabled={loading || baselineChange(baselineN, null).kind === 'invalid'}>Run again</button>
              <button type="button" className="secondary" onClick={onReset} title={TEXT.resetHint}>Reset to defaults</button>
            </div>
            {specError && <p className="error" role="alert" id="spec-error"><strong>Check the allowed values:</strong> {specError}</p>}
          </section>
        </form>

        <div aria-live="polite">
          {loading && <p className="status">Loading analysis...</p>}
          {error && <ErrorBox message={error} />}
        </div>

        {result && <Summary result={result} />}
        <ChartsSection result={result}>
          <BaselineControl value={baselineN} error={baselineError} loading={loading}
            onChange={(v) => { setBaselineN(v); setBaselineError(null) }} onApply={applyBaseline} />
        </ChartsSection>
        {result && <BuildTable builds={result.builds} capable={result.process_capable} hasParams={Object.keys(result.charts.imr).length > 0} />}
        <Legend />
      </main>
    </>
  )
}

/** The plain-English hint (if we know the message) above the raw service text, which stays visible. */
function ErrorBox({ message }) {
  const hint = explainUploadError(message)
  return (
    <div className="error" role="alert">
      <p className="hint-text"><strong>Could not analyze.</strong> {hint ?? message}</p>
      {hint && <span className="raw-text">{TEXT.serviceMessage} {message}</span>}
    </div>
  )
}

/** The "Baseline builds" box. It lives in the Control charts section and stays visible while loading and after an error. */
function BaselineControl({ value, error, loading, onChange, onApply }) {
  return (
    <div className="baseline-control">
      <div className="field">
        <label htmlFor="baseline">{TEXT.baselineLabel}</label>
        <div className="baseline-row">
          <input id="baseline" type="number" min={BASELINE_MIN} step="1" value={value} aria-describedby="baseline-desc"
            aria-invalid={error ? 'true' : undefined}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onApply() } }}
            onBlur={onApply} />
          <button type="button" className="secondary" onClick={onApply} disabled={loading}>{TEXT.updateCharts}</button>
        </div>
        <p id="baseline-desc" className="helper">{TEXT.baselineHelp}<br />{TEXT.baselineDefaults}</p>
        {error && <p className="error" role="alert" id="baseline-error">{error}</p>}
      </div>
    </div>
  )
}

function Summary({ result }) {
  const cap = result.capability
  const capable = result.process_capable
  const first = result.first_out_of_control_build
  const threshold = result.settings.capable_min_index

  return (
    <>
      <section className={`banner ${capable ? 'yes' : 'no'}`} aria-labelledby="banner-h">
        <h2 id="banner-h">
          <span aria-hidden="true">{capable ? '✔' : '✖'}</span>{' '}
          Process Capable? {capable ? 'Yes' : 'No'}
        </h2>
        <p className="first-ooc">
          First out-of-control build: <strong>{first ?? 'None'}</strong>
        </p>
        <ul className="indices">
          {QUALITY.map((q) => {
            const row = capabilityRow(cap[q.key], q.index, threshold)
            return (
              <li key={q.key} className={row.unreliable ? 'unreliable' : row.status === 'below' ? 'below-min' : ''}>
                <span className="index-name">{q.indexName}</span>
                <span className="index-value">{row.text}</span>
                {row.unreliable && (
                  <span className="index-warning">
                    <span aria-hidden="true">⚠</span> {UNRELIABLE_TEXT}
                  </span>
                )}
                {row.statusText && (
                  <span className={`index-meta status-${row.status}`}>
                    <span aria-hidden="true">{row.status === 'below' ? '⚠ ' : '✔ '}</span>
                    {row.statusText}
                  </span>
                )}
                {row.message && <span className="index-meta">{row.message}</span>}
              </li>
            )
          })}
        </ul>
        <p className="how">
          {TEXT.howToRead.replace('{threshold}', fmt(threshold, 2))}
        </p>
        {result.warnings.length > 0 && (
          <details>
            <summary>Notes from the analysis ({result.warnings.length})</summary>
            <ul className="notes-list">{result.warnings.map((w) => <li key={w}>{plainNote(w)}</li>)}</ul>
          </details>
        )}
      </section>

      <section className="summary" id="summary" aria-labelledby="summary-h">
        <h2 id="summary-h">Summary</h2>
        <p>{summarySentence(result)}</p>
      </section>
    </>
  )
}

/** The Control charts section. `result` is null while loading or after an error; the baseline box (children) stays. */
function ChartsSection({ result, children }) {
  const baselineUsed = result ? result.settings.baseline_n_used : null
  const paramNames = result
    ? [...MAIN_PARAMS.filter((name) => result.charts.imr[name]), ...Object.keys(result.charts.imr).filter((name) => !MAIN_PARAMS.includes(name))]
    : []
  const hasParams = paramNames.length > 0
  return (
    <section aria-labelledby="charts-h">
      <h2 id="charts-h">Control charts</h2>
      <ul className="charts-intro">{TEXT.chartsIntro.map((t) => <li key={t}>{t}</li>)}</ul>
      {children}
      {result && (
        <>
        <h2>{TEXT.qualityHeading}</h2>
        {QUALITY.map((q) => (
          <QualityCharts key={q.key} q={q} result={result} baselineUsed={baselineUsed} />
        ))}

        <h2>{TEXT.paramsHeading}</h2>
        {!hasParams && <p className="param-note">{TEXT.noParams}</p>}
        {paramNames.map((name, k) => (
          <ParamCharts key={name} name={name} p={result.charts.imr[name]} ids={result.build_ids} baselineUsed={baselineUsed} defaultOpen={k === 0} />
        ))}
        </>
      )}
    </section>
  )
}

/** Number of builds that broke at least one rule on any of the given charts (each has a rules array per point). */
function flaggedBuilds(...charts) {
  const flagged = new Set()
  charts.forEach((c) => c.rules.forEach((r, i) => { if (r && r.length > 0) flagged.add(c.buildIds ? c.buildIds[i] : i) }))
  return flagged.size
}

/** One row of charts inside a drop-down: the title, whether any rule was broken (so a closed row still tells you), then the charts. */
function ChartRow({ title, flagged, defaultOpen, children }) {
  return (
    <details className="chart-row" open={defaultOpen}>
      <summary>
        {title}{' '}
        {flagged > 0
          ? <span className="row-status flagged"><span aria-hidden="true">✖</span> Rule broken</span>
          : <span className="row-status clean"><span aria-hidden="true">✔</span> No rule broken</span>}
      </summary>
      {children}
    </details>
  )
}

function QualityCharts({ q, result, baselineUsed }) {
  const chart = result.charts[q.key]
  const ids = chart.build_ids
  const xb = xbarProps(chart, []) // the allowed values are for single coupons, so they are not drawn on a chart of build averages
  const rr = rProps(chart)
  return (
    <ChartRow title={q.title} flagged={flaggedBuilds(xb, rr)} defaultOpen>
      <div className="chart-pair">
        <ControlChart title={chartTitle('xbar', q.title, q.unit)} kind="xbar" unit={q.unit} buildIds={ids} baselineN={baselineUsed}
          digits={q.digits} {...xb} />
        <ControlChart title={chartTitle('r', q.title, q.unit)} kind="r" unit={q.unit} buildIds={ids} baselineN={baselineUsed}
          digits={q.digits} {...rr} />
      </div>
    </ChartRow>
  )
}

function ParamCharts({ name, p, ids, baselineUsed, defaultOpen }) {
  const meta = PARAMS[name] || { title: name, unit: '', digits: 2 }
  const ip = iProps(p)
  const mp = mrProps(p)
  return (
    <ChartRow title={meta.title} flagged={flaggedBuilds(ip, mp)} defaultOpen={defaultOpen}>
      <div className="chart-pair">
        <ControlChart title={chartTitle('i', meta.title, meta.unit)} kind="i" unit={meta.unit} buildIds={ids} baselineN={baselineUsed}
          digits={meta.digits} {...ip} />
        <ControlChart title={chartTitle('mr', meta.title, meta.unit)} kind="mr" unit={meta.unit} buildIds={ids} baselineN={baselineUsed}
          digits={meta.digits} {...mp} />
      </div>
    </ChartRow>
  )
}

const BADGE_ICON = { RELEASE: '✔', QUARANTINE: '✖' }

function BuildTable({ builds, capable, hasParams }) {
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const rows = onlyFlagged ? builds.filter((b) => b.disposition === 'QUARANTINE') : builds
  return (
    <section aria-labelledby="table-h">
      <h2 id="table-h">Builds</h2>
      <label className="toggle">
        <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
        {TEXT.flaggedToggle}
      </label>
      {!capable && <p className="not-capable-note" role="note"><span aria-hidden="true">⚠</span> {TEXT.notCapableTable}</p>}
      <p className="muted">{rows.length} of {builds.length} builds shown.</p>
      {!hasParams && <p className="muted">{TEXT.noParamsShort}</p>}
      <div className={`table-wrap${capable ? '' : ' greyed'}`}>
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
                  {!capable && b.disposition === 'RELEASE'
                    ? <span className="badge held"><span aria-hidden="true">✖</span> NOT RELEASED</span>
                    : (
                      <span className={`badge ${b.disposition.toLowerCase()}`}>
                        <span aria-hidden="true">{BADGE_ICON[b.disposition]}</span> {b.disposition}
                      </span>
                    )}
                </td>
                <td>
                  {b.rules_broken.length
                    ? <ul className="rules-list">{b.rules_broken.map((r) => <li key={r}>{explainRule(r)}</li>)}</ul>
                    : '-'}
                </td>
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
      <p>{TEXT.legendIntro}</p>
      <ol>
        {LEGEND_RULES.map(([n, text]) => <li key={n} value={n}><strong>Rule {n}.</strong> {text}</li>)}
      </ol>
      <p><strong>Disposition.</strong></p>
      <ul>
        <li><strong>QUARANTINE</strong>: {TEXT.quarantine}</li>
        <li><strong>RELEASE</strong>: {TEXT.release}</li>
      </ul>
      <p className="muted">{TEXT.falseAlarms}</p>
    </section>
  )
}

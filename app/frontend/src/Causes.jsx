import {
  anovaRows, capitalizeAfterColon, factorsState, introSentences, metricStatus, metricToOpen, noteLines, plotModel, skippedReasons, summaryLines,
} from './causes.js'
import InteractionPlot from './InteractionPlot.jsx'
import { QUALITY, TEXT } from './labels.js'

// The "Possible Causes by Machine and Material Lot" section. All numbers and yes/no answers come from
// result.factors (the analysis service); causes.js turns them into words and this file lays them out.

const T = TEXT.causes

export default function Causes({ factors, onOpenCsv }) {
  const state = factorsState(factors)
  return (
    <section aria-labelledby="causes-h" id="causes">
      <h2 id="causes-h" className="section-title">{T.heading}</h2>
      {state === 'none' && (
        <p className="param-note">
          {T.noColumns}{' '}
          <button type="button" className="link-button inline" onClick={onOpenCsv}>{TEXT.csvButton}</button>
        </p>
      )}
      {state !== 'none' && <Body factors={factors} state={state} />}
    </section>
  )
}

function Body({ factors, state }) {
  const reasons = skippedReasons(factors)
  const notes = noteLines(factors)
  const open = metricToOpen(factors, QUALITY)
  return (
    <>
      <p className="causes-intro">{introSentences(factors).join(' ')}</p>
      <div className="read-first">
        <p><strong>{T.readFirst}</strong></p>
        <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
      {reasons.length > 0 && (
        <div className="param-note">
          <p><strong>{T.skippedHeading}</strong></p>
          <ul>{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {state === 'unusable' && factors.message && <p className="param-note">{capitalizeAfterColon(factors.message)}</p>}
      {state === 'ok' && QUALITY.map((q) => (
        <MetricRow key={q.key} q={q} metric={factors.metrics && factors.metrics[q.key]} factors={factors} defaultOpen={q.key === open} />
      ))}
    </>
  )
}

function MetricRow({ q, metric, factors, defaultOpen }) {
  const status = metricStatus(metric)
  const model = plotModel(q, metric, factors)
  const rows = anovaRows(metric, factors)
  const lines = metric ? summaryLines(q, metric, factors) : []
  const rowClass = status.kind === 'found' ? 'flagged' : status.kind === 'none' ? 'clean' : 'untested'
  return (
    <details className="chart-row" open={defaultOpen}>
      <summary>
        {q.title}{' '}
        <span className={`row-status ${rowClass}`}><span aria-hidden="true">{status.icon}</span> {status.text}</span>
      </summary>
      {model ? <InteractionPlot q={q} model={model} /> : <p className="muted">No plot is available for this measurement.</p>}
      {lines.length > 0 && (
        <div className="causes-summary">
          <p><strong>{T.summaryHeading}</strong></p>
          {lines.map((l) => <p key={l} className={`summary-line ${rowClass}`}>{l}</p>)}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <div className="table-wrap anova-wrap">
            <table className="anova">
              <caption className="sr-only">{q.title}: {T.tableLabel}</caption>
              <thead>
                <tr>{T.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.source}>
                    <th scope="row">{r.source}</th>
                    <td>{r.df}</td><td>{r.ss}</td><td>{r.ms}</td><td>{r.f}</td><td>{r.p}</td>
                    <td className={r.kind === 'found' ? 'verdict-found' : undefined}>
                      {r.kind === 'found' && <span aria-hidden="true">✖ </span>}{r.verdict}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chart-note">{T.tableHelp}</p>
        </>
      )}
      {metric && metric.message && <p className="param-note">{capitalizeAfterColon(metric.message)}</p>}
    </details>
  )
}

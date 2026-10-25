// Pure helpers for the "Possible Causes by Machine and Material Lot" section (H-19).
// The analysis service did all the statistics (cell means, standard errors, the ANOVA table and the
// `significant` flags). Nothing here tests anything: it formats numbers, picks words and arranges the
// service's means into a plot. The one bit of arithmetic is the difference of two displayed means.

import { TEXT } from './labels.js'

const T = TEXT.causes

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

/** A capital letter at the start and after every ": " (the API's sentences start in lower case). */
export function capitalizeAfterColon(text) {
  if (text === null || text === undefined) return ''
  return String(text)
    .replace(/^\s*([a-z])/, (m, c) => m.slice(0, -1) + c.toUpperCase())
    .replace(/(: )([a-z])/g, (m, colon, c) => colon + c.toUpperCase())
}

/** Sums of squares and mean squares: 3 significant digits, tiny numbers as 1.83e-6; no value -> 'not available'. */
export function fmtCompact(v) {
  if (!isNum(v)) return T.unavailable
  if (v === 0) return '0'
  if (Math.abs(v) < 0.0001 || Math.abs(v) >= 100000) return v.toExponential(2).replace('e-0', 'e-').replace('e+0', 'e+').replace('e+', 'e')
  return v.toPrecision(3)
}

/** F ratio: 2 decimals. */
export function fmtF(v) {
  return isNum(v) ? v.toFixed(2) : T.unavailable
}

/** p-value: 4 decimals, or '< 0.001' for the very small ones. */
export function fmtP(p) {
  if (!isNum(p)) return T.unavailable
  return p < 0.001 ? '< 0.001' : p.toFixed(4)
}

function fmtDf(v) {
  return isNum(v) ? String(v) : T.unavailable
}

/** The verdict words for one ANOVA entry: the API's `significant` flag decides; anything null is Not tested. */
export function verdictFor(entry) {
  if (!entry || !isNum(entry.p) || typeof entry.significant !== 'boolean') return { kind: 'untested', text: T.verdictUntested }
  if (entry.significant) return { kind: 'found', text: `${T.verdictFound} (p-value ${fmtP(entry.p)})` }
  return { kind: 'none', text: T.verdictNone }
}

const EFFECTS = ['machine', 'lot', 'interaction']

/** The status shown on a closed row: red when any effect is significant, green when some were tested and none is. */
export function metricStatus(metric) {
  const anova = (metric && metric.anova) || {}
  const kinds = EFFECTS.map((k) => verdictFor(anova[k]).kind)
  if (kinds.includes('found')) return { kind: 'found', text: T.status.found, icon: '✖' }
  if (kinds.includes('none')) return { kind: 'none', text: T.status.none, icon: '✔' }
  return { kind: 'untested', text: T.status.untested, icon: '–' }
}

/** Key of the one measurement to open: the first with a significant effect, else the first one. */
export function metricToOpen(factors, quality) {
  const metrics = (factors && factors.metrics) || {}
  const hit = quality.find((q) => metricStatus(metrics[q.key]).kind === 'found')
  return (hit || quality[0]).key
}

/** 'none' = no machine or lot column (factors is null); 'unusable' = columns were there but no factor could be analysed. */
export function factorsState(factors) {
  if (!factors) return 'none'
  const usable = (factors.machine_levels || []).length >= 2 || (factors.lot_levels || []).length >= 2
  return usable ? 'ok' : 'unusable'
}

/** The API's reasons for skipping a column, in plain words. */
export function skippedReasons(factors) {
  if (!factors || !factors.skipped) return []
  return Object.values(factors.skipped).map(capitalizeAfterColon)
}

/** The API's standing notes, with a capital letter after each colon. */
export function noteLines(factors) {
  return factors && Array.isArray(factors.notes) ? factors.notes.map(capitalizeAfterColon) : []
}

function plural(n, one, many) {
  return n === 1 ? one : many
}

/** The two short sentences under the heading. */
export function introSentences(factors) {
  const used = factors.builds_used
  const out = factors.builds_excluded
  const left = out === 0 ? 'no quarantined builds are left out' : `${out} quarantined ${plural(out, 'build is', 'builds are')} left out`
  return [T.intro, `The ${used} ${plural(used, 'build', 'builds')} used ${plural(used, 'is', 'are')} compared, and ${left}.`]
}

function levelsOf(factors) {
  return { machine: factors.machine_levels || [], lot: factors.lot_levels || [] }
}

function byMean(means) {
  const good = (means || []).filter((m) => m && isNum(m.mean))
  if (good.length < 2) return null
  const sorted = [...good].sort((a, b) => a.mean - b.mean)
  return { lowest: sorted[0], highest: sorted[sorted.length - 1], count: good.length }
}

function unitText(q) {
  return q.unit ? ` ${q.unit}` : ''
}

function numberText(q, v) {
  return v.toFixed(q.digits + 1)
}

function effectLine(q, label, means, entry) {
  const p = fmtP(entry.p)
  const range = byMean(means)
  if (!range) return `${label} averages differ (p-value ${p}).`
  if (range.count === 2) {
    const diff = range.highest.mean - range.lowest.mean
    return `${label} ${range.highest.level} averages higher than ${range.lowest.level} by ${numberText(q, diff)}${unitText(q)} (p-value ${p}).`
  }
  return `${label} averages differ: Highest is ${range.highest.level} (${numberText(q, range.highest.mean)}${unitText(q)}) and lowest is ${range.lowest.level} (${numberText(q, range.lowest.mean)}${unitText(q)}) (p-value ${p}).`
}

/** One to three plain sentences about a measurement, from the API's flags and means. */
export function summaryLines(q, metric, factors) {
  const anova = (metric && metric.anova) || {}
  const lines = []
  if (verdictFor(anova.machine).kind === 'found') lines.push(effectLine(q, 'Machine', metric.machine_means, anova.machine))
  if (verdictFor(anova.lot).kind === 'found') lines.push(effectLine(q, 'Material lot', metric.lot_means, anova.lot))
  if (verdictFor(anova.interaction).kind === 'found') lines.push(`The machine effect is not the same in every lot (p-value ${fmtP(anova.interaction.p)}).`)
  if (lines.length) return lines
  const lv = levelsOf(factors)
  const tested = EFFECTS.filter((k) => verdictFor(anova[k]).kind === 'none')
  if (tested.length === 0) return ['Nothing could be tested for this measurement.']
  const both = lv.machine.length >= 2 && lv.lot.length >= 2
  if (both) return ['No difference was found between machines or between material lots.']
  return [lv.machine.length >= 2 ? 'No difference was found between machines.' : 'No difference was found between material lots.']
}

function row(source, entry, withTest) {
  if (!entry) {
    return { source, df: T.unavailable, ss: T.unavailable, ms: T.unavailable, f: withTest ? T.unavailable : '', p: withTest ? T.unavailable : '', verdict: withTest ? T.verdictUntested : '', kind: 'untested' }
  }
  const v = withTest ? verdictFor(entry) : { kind: 'none', text: '' }
  return {
    source, df: fmtDf(entry.df), ss: fmtCompact(entry.ss), ms: fmtCompact(entry.ms),
    f: withTest ? fmtF(entry.f) : '', p: withTest ? fmtP(entry.p) : '', verdict: v.text, kind: v.kind,
  }
}

/** The ANOVA table rows. A factor that could not be used has no row; an effect that could not be tested is Not tested. */
export function anovaRows(metric, factors) {
  if (!metric || !metric.anova) return []
  const lv = levelsOf(factors)
  const anova = metric.anova
  const rows = []
  if (lv.machine.length >= 2) rows.push(row(T.sources.machine, anova.machine, true))
  if (lv.lot.length >= 2) rows.push(row(T.sources.lot, anova.lot, true))
  if (lv.machine.length >= 2 && lv.lot.length >= 2) rows.push(row(T.sources.interaction, anova.interaction, true))
  if (anova.error) rows.push(row(T.sources.error, anova.error, false))
  return rows
}

/**
 * What to draw. Two factors: one line per machine across the material lots. One factor: a single line
 * across its levels. points[i] is null where the combination has no builds (a gap in the line).
 * lo / hi cover every mean and, where the service gave one, mean ± one standard error.
 */
export function plotModel(q, metric, factors) {
  if (!metric || !Array.isArray(metric.cells) || !factors) return null
  const lv = levelsOf(factors)
  const useMachine = lv.machine.length >= 2
  const useLot = lv.lot.length >= 2
  let xKey, xLevels, xLabel, groups
  if (useMachine && useLot) {
    xKey = 'lot'; xLevels = lv.lot; xLabel = T.xLot
    groups = lv.machine.map((m) => ({ name: m, match: (c) => c.machine === m }))
  } else if (useMachine || useLot) {
    xKey = useMachine ? 'machine' : 'lot'; xLevels = useMachine ? lv.machine : lv.lot; xLabel = useMachine ? T.xMachine : T.xLot
    groups = [{ name: T.allBuilds, match: () => true }]
  } else {
    return null
  }
  const values = []
  const series = groups.map((g) => ({
    name: g.name,
    points: xLevels.map((level) => {
      const c = metric.cells.find((cell) => cell && cell[xKey] === level && g.match(cell) && isNum(cell.mean))
      if (!c) return null
      const se = isNum(c.se) ? c.se : null
      values.push(c.mean)
      if (se !== null) values.push(c.mean - se, c.mean + se)
      return { mean: c.mean, se, n: c.n_builds }
    }),
  }))
  if (values.length === 0) return null
  return { xLabel, xLevels, series, lo: Math.min(...values), hi: Math.max(...values), showSeries: series.length > 1 }
}

/** Hover text for one point, for example 'AM-02, Ti64-Lot-23: Average 0.0214 mm (5 builds)'. */
export function pointTip(q, seriesName, level, point, showSeries) {
  const name = showSeries ? `${seriesName}, ${level}` : level
  const n = point.n_builds ?? point.n
  const builds = isNum(n) ? ` (${n} ${plural(n, 'build', 'builds')})` : ''
  return `${name}: Average ${numberText(q, point.mean)}${unitText(q)}${builds}`
}

function joinWords(list) {
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** The aria-label of the plot. */
export function plotSummary(q, model) {
  const lines = model.showSeries ? `Lines for ${joinWords(model.series.map((s) => s.name))} across ` : 'One line across '
  return `${q.title}: Interaction plot. ${lines}${model.xLabel.toLowerCase()} ${joinWords(model.xLevels)}. `
    + `Averages run from ${numberText(q, model.lo)} to ${numberText(q, model.hi)}${unitText(q)}.`
}

/** The caption under a plot. */
export function plotCaption(model) {
  return model.showSeries ? T.plotCaptionTwo : T.plotCaptionOne
}

/** Every sentence this section can show for the given answer (used by the wording tests). */
export function causesTexts(factors, quality) {
  const out = [T.heading, T.intro, T.readFirst, T.noColumns, T.skippedHeading, T.tableHelp, T.summaryHeading, T.tableLabel,
    T.plotCaptionOne, T.plotCaptionTwo, ...T.columns, ...Object.values(T.status), ...Object.values(T.sources)]
  if (!factors) return out
  out.push(...introSentences(factors), ...noteLines(factors), ...skippedReasons(factors))
  if (factors.message) out.push(capitalizeAfterColon(factors.message))
  for (const q of quality) {
    const metric = factors.metrics && factors.metrics[q.key]
    if (!metric) continue
    out.push(metricStatus(metric).text, ...summaryLines(q, metric, factors))
    if (metric.message) out.push(capitalizeAfterColon(metric.message))
    for (const r of anovaRows(metric, factors)) out.push(r.source, r.df, r.ss, r.ms, r.f, r.p, r.verdict)
    const model = plotModel(q, metric, factors)
    if (model) {
      out.push(plotSummary(q, model), plotCaption(model))
      model.series.forEach((s) => s.points.forEach((p, i) => { if (p) out.push(pointTip(q, s.name, model.xLevels[i], p, model.showSeries)) }))
    }
  }
  return out.filter((t) => typeof t === 'string' && t !== '')
}

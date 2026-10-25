import { describe, it, expect } from 'vitest'
import {
  capitalizeAfterColon, fmtCompact, fmtP, fmtF, verdictFor, metricStatus, metricToOpen, introSentences,
  summaryLines, anovaRows, plotModel, pointTip, plotSummary, factorsState, skippedReasons, causesTexts,
} from './causes.js'
import { QUALITY } from './labels.js'

const DEV = QUALITY[2] // Dimensional deviation, mm, 3 digits

const cell = (machine, lot, mean, se = 0.001, n = 5) => ({ machine, lot, n_builds: n, mean, sd: 0.002, se })
const entry = (p, significant, f = 5) => ({ df: 1, ss: 0.0023337, ms: 0.0023337, f, p, significant })

/** A two-factor answer shaped like the API: AM-02 is higher on the dimensional deviation. */
function twoFactor(over = {}) {
  const metric = {
    cells: [
      cell('AM-01', 'L1', 0.004), cell('AM-01', 'L2', 0.003), cell('AM-01', 'L3', 0.0045),
      cell('AM-02', 'L1', 0.021), cell('AM-02', 'L2', 0.0214, 0.002), cell('AM-02', 'L3', 0.0215),
    ],
    machine_means: [{ level: 'AM-01', n_builds: 15, mean: 0.0037333 }, { level: 'AM-02', n_builds: 15, mean: 0.0213733 }],
    lot_means: [{ level: 'L1', n_builds: 10, mean: 0.0125 }, { level: 'L2', n_builds: 10, mean: 0.0122 }, { level: 'L3', n_builds: 10, mean: 0.013 }],
    anova: {
      machine: entry(0.0015336904, true, 12.77), lot: entry(0.88, false, 0.13), interaction: entry(0.92, false, 0.08),
      error: { df: 24, ss: 0.00438, ms: 0.00018 },
    },
    message: null,
  }
  return {
    unit: 'build average', alpha: 0.05, builds_used: 30, builds_excluded: 0,
    machine_levels: ['AM-01', 'AM-02'], lot_levels: ['L1', 'L2', 'L3'], skipped: {},
    notes: ['This shows association, not cause: a machine or lot may only be linked to the real cause.'], message: null,
    metrics: { uts_MPa: metric, porosity_pct: metric, dimensional_dev_mm: metric },
    ...over,
  }
}

describe('number formatting never prints NaN or undefined', () => {
  it('p-value: four decimals, or < 0.001', () => {
    expect(fmtP(0.0015336904)).toBe('0.0015')
    expect(fmtP(0.5807)).toBe('0.5807')
    expect(fmtP(0.0004)).toBe('< 0.001')
    expect(fmtP(null)).toBe('not available')
    expect(fmtP(undefined)).toBe('not available')
    expect(fmtP(NaN)).toBe('not available')
  })
  it('compact numbers for sums of squares', () => {
    expect(fmtCompact(191.34447)).toBe('191')
    expect(fmtCompact(2.4998533)).toBe('2.50')
    expect(fmtCompact(0.0023337)).toBe('0.00233')
    expect(fmtCompact(1.8253e-6)).toBe('1.83e-6')
    expect(fmtCompact(0)).toBe('0')
    for (const bad of [null, undefined, NaN, Infinity, 'x']) expect(fmtCompact(bad)).toBe('not available')
    expect(fmtF(12.7732)).toBe('12.77')
    expect(fmtF(null)).toBe('not available')
  })
  it('puts a capital after every colon', () => {
    expect(capitalizeAfterColon('machine_id skipped: build B-1 has a blank value; fix it')).toBe('Machine_id skipped: Build B-1 has a blank value; fix it')
    expect(capitalizeAfterColon('no builds in AM-02, so it cannot be tested')).toBe('No builds in AM-02, so it cannot be tested')
    expect(capitalizeAfterColon(null)).toBe('')
  })
})

describe('verdicts and the status of a measurement', () => {
  it('uses the API significant flag', () => {
    expect(verdictFor(entry(0.0015336904, true)).text).toBe('Likely a real difference (p-value 0.0015)')
    expect(verdictFor(entry(0.0004, true)).text).toBe('Likely a real difference (p-value < 0.001)')
    expect(verdictFor(entry(0.58, false)).text).toBe('No evidence of a difference')
  })
  it('says Not tested for null entries, null p and null significant', () => {
    expect(verdictFor(null).text).toBe('Not tested')
    expect(verdictFor(entry(null, null)).text).toBe('Not tested')
    expect(verdictFor(entry(null, true)).text).toBe('Not tested')
    expect(verdictFor(entry(0.3, null)).text).toBe('Not tested')
    expect(verdictFor(undefined).kind).toBe('untested')
  })
  it('status: difference found, no difference found, not tested', () => {
    const f = twoFactor()
    expect(metricStatus(f.metrics.dimensional_dev_mm)).toMatchObject({ kind: 'found', text: 'Difference found', icon: '✖' })
    const calm = { ...f.metrics.dimensional_dev_mm, anova: { ...f.metrics.dimensional_dev_mm.anova, machine: entry(0.5, false) } }
    expect(metricStatus(calm)).toMatchObject({ kind: 'none', text: 'No difference found', icon: '✔' })
    const nothing = { cells: [], anova: { machine: null, lot: null, interaction: null, error: null }, message: 'x' }
    expect(metricStatus(nothing)).toMatchObject({ kind: 'untested', text: 'Not tested' })
    expect(metricStatus(null).kind).toBe('untested')
    expect(metricStatus({ anova: null }).kind).toBe('untested')
  })
  it('a null interaction does not hide a tested main effect', () => {
    const m = twoFactor().metrics.uts_MPa
    const part = { ...m, anova: { ...m.anova, machine: entry(0.2, false), lot: null, interaction: null } }
    expect(metricStatus(part).kind).toBe('none')
  })
  it('opens only the measurement with a significant effect, else the first', () => {
    const f = twoFactor()
    const quiet = { ...f.metrics.uts_MPa, anova: { machine: entry(0.5, false), lot: entry(0.5, false), interaction: entry(0.5, false), error: null } }
    expect(metricToOpen({ ...f, metrics: { uts_MPa: quiet, porosity_pct: quiet, dimensional_dev_mm: f.metrics.dimensional_dev_mm } }, QUALITY)).toBe('dimensional_dev_mm')
    const calm = { ...f.metrics.uts_MPa, anova: { machine: entry(0.5, false), lot: null, interaction: null, error: null } }
    expect(metricToOpen({ ...f, metrics: { uts_MPa: calm, porosity_pct: calm, dimensional_dev_mm: calm } }, QUALITY)).toBe('uts_MPa')
  })
})

describe('intro, notes state and skipped reasons', () => {
  it('has two short sentences with the build counts', () => {
    const s = introSentences(twoFactor({ builds_used: 22, builds_excluded: 8 }))
    expect(s).toHaveLength(2)
    expect(s[0]).toBe('This checks whether builds differ by machine or by material lot, using one average per build.')
    expect(s[1]).toBe('The 22 builds used are compared, and 8 quarantined builds are left out.')
    expect(introSentences(twoFactor({ builds_used: 29, builds_excluded: 1 }))[1]).toBe('The 29 builds used are compared, and 1 quarantined build is left out.')
    expect(introSentences(twoFactor())[1]).toBe('The 30 builds used are compared, and no quarantined builds are left out.')
  })
  it('null factors means the file has no machine or lot columns', () => {
    expect(factorsState(null)).toBe('none')
    expect(factorsState(undefined)).toBe('none')
    expect(skippedReasons(null)).toEqual([])
  })
  it('a block with no usable level is unusable, and keeps the reasons', () => {
    const f = twoFactor({ machine_levels: [], lot_levels: [], skipped: { machine_id: 'machine_id skipped: build B-1 has a blank machine_id value; give every row one' }, message: 'No factor could be analysed.' })
    expect(factorsState(f)).toBe('unusable')
    expect(factorsState(twoFactor())).toBe('ok')
    expect(skippedReasons(f)).toEqual(['Machine_id skipped: Build B-1 has a blank machine_id value; give every row one'])
  })
})

describe('the plain-language summary', () => {
  it('says which machine averages higher and by how much (arithmetic on API means)', () => {
    const lines = summaryLines(DEV, twoFactor().metrics.dimensional_dev_mm, twoFactor())
    expect(lines).toEqual(['Machine AM-02 averages higher than AM-01 by 0.0176 mm (p-value 0.0015).'])
  })
  it('names the highest and lowest lot when there are three', () => {
    const f = twoFactor()
    const m = { ...f.metrics.uts_MPa, anova: { ...f.metrics.uts_MPa.anova, machine: entry(0.5, false), lot: entry(0.01, true) } }
    expect(summaryLines(DEV, m, f)).toEqual(['Material lot averages differ: Highest is L3 (0.0130 mm) and lowest is L2 (0.0122 mm) (p-value 0.0100).'])
  })
  it('says no difference when nothing is significant, and not tested when nothing ran', () => {
    const f = twoFactor()
    const calm = { ...f.metrics.uts_MPa, anova: { machine: entry(0.5, false), lot: entry(0.5, false), interaction: null, error: null } }
    expect(summaryLines(DEV, calm, f)).toEqual(['No difference was found between machines or between material lots.'])
    const none = { cells: [], anova: { machine: null, lot: null, interaction: null, error: null }, message: 'm' }
    expect(summaryLines(DEV, none, f)).toEqual(['Nothing could be tested for this measurement.'])
  })
  it('reports a significant interaction', () => {
    const f = twoFactor()
    const m = { ...f.metrics.uts_MPa, anova: { machine: entry(0.5, false), lot: entry(0.5, false), interaction: entry(0.02, true), error: null } }
    expect(summaryLines(DEV, m, f)).toContain('The machine effect is not the same in every lot (p-value 0.0200).')
  })
  it('skips a significant effect whose means are missing instead of printing NaN', () => {
    const f = twoFactor()
    const m = { ...f.metrics.dimensional_dev_mm, machine_means: null }
    const lines = summaryLines(DEV, m, f)
    expect(lines.join(' ')).not.toMatch(/NaN|undefined|null/)
  })
  it('works with one factor only', () => {
    const f = twoFactor({ lot_levels: [] })
    const m = { cells: [cell('AM-01', null, 0.004), cell('AM-02', null, 0.02)], machine_means: twoFactor().metrics.uts_MPa.machine_means, lot_means: null, anova: { machine: entry(0.001, true), lot: null, interaction: null, error: null }, message: null }
    expect(summaryLines(DEV, m, f)).toEqual(['Machine AM-02 averages higher than AM-01 by 0.0176 mm (p-value 0.0010).'])
  })
})

describe('the ANOVA table rows', () => {
  it('has machine, lot, interaction and error rows with plain verdicts', () => {
    const rows = anovaRows(twoFactor().metrics.dimensional_dev_mm, twoFactor())
    expect(rows.map((r) => r.source)).toEqual(['Machine', 'Material lot', 'Machine × lot interaction', 'Error (within combinations)'])
    expect(rows[0]).toMatchObject({ df: '1', ss: '0.00233', ms: '0.00233', f: '12.77', p: '0.0015', verdict: 'Likely a real difference (p-value 0.0015)' })
    expect(rows[1].verdict).toBe('No evidence of a difference')
    expect(rows[3]).toMatchObject({ df: '24', f: '', p: '', verdict: '' })
  })
  it('a null interaction is a Not tested row; null p and f print as not available', () => {
    const f = twoFactor()
    const m = { ...f.metrics.uts_MPa, anova: { machine: entry(null, null, null), lot: entry(0.3, false), interaction: null, error: { df: 0, ss: 0, ms: 0 } }, message: 'exact fit' }
    const rows = anovaRows(m, f)
    expect(rows[0]).toMatchObject({ f: 'not available', p: 'not available', verdict: 'Not tested' })
    expect(rows[2]).toMatchObject({ source: 'Machine × lot interaction', verdict: 'Not tested', df: 'not available' })
    expect(JSON.stringify(rows)).not.toMatch(/NaN|undefined|null/)
  })
  it('one factor: no interaction row and no row for the missing factor', () => {
    const f = twoFactor({ lot_levels: [] })
    const m = { cells: [], machine_means: [], lot_means: null, anova: { machine: entry(0.01, true), lot: null, interaction: null, error: { df: 28, ss: 1, ms: 0.03 } }, message: null }
    expect(anovaRows(m, f).map((r) => r.source)).toEqual(['Machine', 'Error (within combinations)'])
  })
  it('a missing metric gives no rows', () => {
    expect(anovaRows(null, twoFactor())).toEqual([])
  })
})

describe('the interaction plot model', () => {
  it('has one line per machine across the lots, in API order', () => {
    const model = plotModel(DEV, twoFactor().metrics.dimensional_dev_mm, twoFactor())
    expect(model.xLabel).toBe('Material lot')
    expect(model.xLevels).toEqual(['L1', 'L2', 'L3'])
    expect(model.series.map((s) => s.name)).toEqual(['AM-01', 'AM-02'])
    expect(model.series[1].points[1].mean).toBe(0.0214)
    expect(model.series[1].points[1].se).toBe(0.002)
    expect(model.lo).toBeLessThan(0.003)
    expect(model.hi).toBeGreaterThan(0.0215)
  })
  it('leaves a gap (null point) for a missing combination, and ignores a null se in the range', () => {
    const f = twoFactor()
    const m = { ...f.metrics.dimensional_dev_mm, cells: f.metrics.dimensional_dev_mm.cells.filter((c) => !(c.machine === 'AM-02' && c.lot === 'L3')).map((c) => (c.lot === 'L1' ? { ...c, se: null } : c)) }
    const model = plotModel(DEV, m, f)
    expect(model.series[1].points[2]).toBeNull()
    expect(model.series[0].points[0].se).toBeNull()
    expect(Number.isFinite(model.lo) && Number.isFinite(model.hi)).toBe(true)
  })
  it('one factor draws a single line across that factor', () => {
    const f = twoFactor({ machine_levels: [] })
    const m = { cells: [cell(null, 'L1', 0.01), cell(null, 'L2', 0.02), cell(null, 'L3', 0.015)], lot_means: [], machine_means: null, anova: {}, message: null }
    const model = plotModel(DEV, m, f)
    expect(model.xLabel).toBe('Material lot')
    expect(model.xLevels).toEqual(['L1', 'L2', 'L3'])
    expect(model.series).toHaveLength(1)
    expect(model.series[0].points.map((p) => p.mean)).toEqual([0.01, 0.02, 0.015])
  })
  it('no usable cell gives no model', () => {
    expect(plotModel(DEV, { cells: [], anova: {} }, twoFactor())).toBeNull()
    expect(plotModel(DEV, null, twoFactor())).toBeNull()
    expect(plotModel(DEV, { cells: [cell('AM-01', 'L1', null)] }, twoFactor())).toBeNull()
  })
  it('tooltip and aria summary use the build count and the unit', () => {
    expect(pointTip(DEV, 'AM-02', 'Ti64-Lot-23', { mean: 0.0214, n_builds: 5 }, true)).toBe('AM-02, Ti64-Lot-23: Average 0.0214 mm (5 builds)')
    expect(pointTip(DEV, 'All builds', 'AM-01', { mean: 0.0037, n_builds: 1 }, false)).toBe('AM-01: Average 0.0037 mm (1 build)')
    const model = plotModel(DEV, twoFactor().metrics.dimensional_dev_mm, twoFactor())
    const s = plotSummary(DEV, model)
    expect(s).toContain('Dimensional deviation')
    expect(s).toContain('AM-01 and AM-02')
    expect(s).toContain('L1, L2 and L3')
    expect(s).not.toMatch(/NaN|undefined/)
  })
})

describe('every string the section shows', () => {
  it('has a capital letter after each colon and no NaN, undefined or null', () => {
    const texts = causesTexts(twoFactor(), QUALITY)
    expect(texts.length).toBeGreaterThan(20)
    for (const t of texts) {
      expect(t).not.toMatch(/NaN|undefined|\bnull\b/)
      expect(/: [a-z]/.test(t.replace(/: [a-z]+_[A-Za-z_]+/g, ': COLUMN')), t).toBe(false)
    }
  })
})

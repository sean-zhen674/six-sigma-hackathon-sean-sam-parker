import { describe, it, expect } from 'vitest'
import {
  explainRule, RULE_PHRASES, ruleTip, chartTitle, plainNote, datasetText,
} from './format.js'
import { spreadLabels } from './scale.js'

// H-11: plain-words helpers. They only turn the API's text into words; no statistics.

describe('explainRule (API rule text -> words)', () => {
  it('has a phrase for each of the 8 Nelson rules', () => {
    expect(Object.keys(RULE_PHRASES)).toHaveLength(8)
    for (let k = 1; k <= 8; k++) expect(RULE_PHRASES[k].length).toBeGreaterThan(10)
  })
  it('turns the documented example into the documented sentence', () => {
    expect(explainRule('uts X-bar rule 5'))
      .toBe('Tensile strength build average chart: Two of three builds far from the center line, same side (Nelson rule 5)')
  })
  it('covers all 8 rules on all 3 quality characteristics (X-bar chart)', () => {
    const names = { uts: 'Tensile strength', porosity: 'Porosity', dimensional: 'Dimensional deviation' }
    for (const [key, name] of Object.entries(names)) {
      for (let k = 1; k <= 8; k++) {
        const text = explainRule(`${key} X-bar rule ${k}`)
        expect(text.startsWith(`${name} build average chart: `)).toBe(true)
        expect(text.endsWith(`(Nelson rule ${k})`)).toBe(true)
        expect(text).toContain(RULE_PHRASES[k].charAt(0).toUpperCase() + RULE_PHRASES[k].slice(1))
      }
    }
  })
  it('spread chart (R) uses rule 1 and says what is broken', () => {
    expect(explainRule('porosity R rule 1'))
      .toBe('Porosity spread chart: One build above the upper control limit (Nelson rule 1)')
    expect(explainRule('dimensional R rule 1')).toContain('Dimensional deviation spread chart')
    expect(explainRule('uts R rule 1')).toContain('Tensile strength spread chart')
  })
  it('an unknown string comes back unchanged', () => {
    expect(explainRule('mystery chart rule 9')).toBe('mystery chart rule 9')
    expect(explainRule('uts Z rule 1')).toBe('uts Z rule 1')
    expect(explainRule('uts X-bar rule 9')).toBe('uts X-bar rule 9')
    expect(explainRule('')).toBe('')
    expect(explainRule(undefined)).toBe('')
  })
  it('chart tooltip text per rule number', () => {
    expect(ruleTip(1, 'xbar')).toBe('one build beyond the control limits (Nelson rule 1)')
    expect(ruleTip(1, 'r')).toBe('one build above the upper control limit (Nelson rule 1)')
    expect(ruleTip(1, 'mr')).toBe('one build above the upper control limit (Nelson rule 1)')
    expect(ruleTip(3, 'i')).toBe('six builds in a row steadily rising or falling (Nelson rule 3)')
    expect(ruleTip(12, 'i')).toBe('rule 12')
  })
})

describe('chart titles', () => {
  it('spell out the chart kind and the unit', () => {
    expect(chartTitle('xbar', 'Tensile strength', 'MPa'))
      .toBe('Tensile strength: Build average chart (X-bar), MPa')
    expect(chartTitle('r', 'Porosity', '%')).toBe('Porosity: Spread chart (R, the range), %')
    expect(chartTitle('i', 'Laser power', 'W')).toBe('Laser power: Single value chart (I), W')
    expect(chartTitle('mr', 'Laser power', 'W'))
      .toBe('Laser power: Moving range chart (MR), W')
  })
})

describe('plainNote (API notes -> words)', () => {
  it('translates the known notes and keeps the numbers', () => {
    expect(plainNote('zero within-build variation: capability indices are undefined'))
      .toBe('There is no variation inside the builds, so the capability indices are undefined.')
    expect(plainNote('chart is out of control: indices are printed but not reliable'))
      .toBe('The chart is out of control, so the capability indices are shown but are not reliable.')
    expect(plainNote('a chart is out of control: capability indices are printed but not reliable'))
      .toBe('A chart is out of control, so the capability indices are shown but are not reliable.')
    expect(plainNote('porosity_pct: porosity is bounded at 0 and skewed, so Cpu is approximate'))
      .toBe('Porosity: Porosity cannot go below 0 and its values are skewed, so its capability index for the upper limit is approximate.')
    expect(plainNote('uts_MPa: baseline coupons look non-normal (Shapiro-Wilk p = 0.012); indices are approximate'))
      .toBe('Tensile strength: The baseline coupons do not look normally distributed (Shapiro-Wilk test, p-value 0.012), so the capability indices are approximate.')
    expect(plainNote('Print-parameter columns not found (skipped): laser_power_W, humidity_pct.'))
      .toBe('These optional print-parameter columns were not found and were skipped: laser_power_W, humidity_pct.')
    expect(plainNote('No print-parameter columns found: the "investigate first" ranking is skipped.'))
      .toBe('No print-parameter columns were found, so the likely cause is not ranked.')
    expect(plainNote('chamber_oxygen_ppm: zero baseline sigma (the parameter did not vary in the baseline): skipped'))
      .toBe('Chamber oxygen: This parameter did not vary in the baseline builds, so it is skipped.')
    expect(plainNote('uts_MPa: only 12 builds (fewer than baseline_n=20): limits use all 12 builds'))
      .toBe('Tensile strength: The file has only 12 builds, fewer than the baseline of 20, so the limits use all 12 builds.')
  })
  it('an unknown note comes back unchanged', () => {
    expect(plainNote('something new')).toBe('something new')
    expect(plainNote(undefined)).toBe('')
  })
})

describe('dataset text', () => {
  it('uses plain descriptions for the bundled datasets and the API text otherwise', () => {
    expect(datasetText('capable_baseline', 'x')).toMatch(/^Capable Baseline: /)
    expect(datasetText('oxygen_drift', 'x')).toMatch(/^Oxygen Drift: /)
    expect(datasetText('marginal_spread', 'x')).toMatch(/^Marginal Spread: /)
    expect(datasetText('oxygen_drift', 'api text')).toContain('Chamber oxygen')
    expect(datasetText('new_one', 'api text')).toBe('api text')
    expect(datasetText('new_one', undefined)).toBe('')
  })
})

describe('spreadLabels', () => {
  it('leaves labels that already have room where they are', () => {
    expect(spreadLabels([{ y: 50, h: 14 }, { y: 120, h: 14 }], 0, 250)).toEqual([50, 120])
  })
  it('pushes overlapping labels apart, keeping the order', () => {
    const ys = spreadLabels([{ y: 100, h: 14 }, { y: 102, h: 14 }, { y: 103, h: 14 }], 0, 250)
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(14)
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(14)
    expect(ys[0]).toBeLessThan(ys[1])
  })
  it('keeps labels inside the top and bottom edges', () => {
    const ys = spreadLabels([{ y: 2, h: 14 }, { y: 246, h: 14 }], 0, 250)
    expect(ys[0]).toBeGreaterThanOrEqual(7)
    expect(ys[1]).toBeLessThanOrEqual(243)
  })
  it('works on an empty list', () => {
    expect(spreadLabels([], 0, 250)).toEqual([])
  })
})

// ---- new upload errors from the analysis service ----
import { explainUploadError } from './format.js'

describe('explainUploadError: newer messages', () => {
  it('infinite value', () => {
    const h = explainUploadError("HTTP 422: column 'uts_MPa' has an infinite value (row 4 of the file); use ordinary numbers")
    expect(h).toContain('Column uts_MPa')
    expect(h).toContain('endless value')
    expect(h).toContain('delete that row')
  })
  it('True/False values', () => {
    const h = explainUploadError("column 'porosity_pct' contains True/False values; it must contain numbers")
    expect(h).toContain('Column porosity_pct holds True/False')
  })
  it('dates in a number column', () => {
    const h = explainUploadError("column 'uts_MPa' contains dates or times; it must contain numbers")
    expect(h).toContain('holds dates')
    expect(h).toContain('not shifted')
  })
  it('duplicate header', () => {
    const h = explainUploadError("column 'uts_MPa' appears 2 times in the header; keep only one")
    expect(h).toBe('Two columns share the name uts_MPa. Delete one of them, or rename it.')
  })
  it('header only', () => {
    expect(explainUploadError('HTTP 422: the file has a header but no data rows')).toContain('five rows for each build')
  })
  it('the changed timestamp and coupon-count messages still match', () => {
    expect(explainUploadError("build_timestamp is not a valid date/time (for example 'last Tuesday'); use a form like 2026-01-05T08:00:00"))
      .toContain('2026-01-05T08:00:00')
    expect(explainUploadError('build B-0002 has 4 coupons; each build needs exactly 5 coupons'))
      .toContain('Build B-0002 has 4 coupon rows')
  })
  it('an unknown message still gives null', () => {
    expect(explainUploadError('HTTP 422: something else entirely')).toBeNull()
  })
})

// ---- H-13: the first word after every colon on the page starts with a capital letter ----
import { TOUR_STEPS } from './tour.js'
import { TEXT, QUALITY, LEGEND_RULES } from './labels.js'
import { CHART_HELP, UNRELIABLE_TEXT, explainUploadError, summarySentence, capabilityRow } from './format.js'
import { DATASET_TEXT, chartTitle, plainNote, explainRule, COLUMN_MEANINGS } from './plain.js'

// H-19: the Possible Causes section
import { causesTexts } from './causes.js'
import { factorVariants } from './causes.fixture.js'

// H-17: the calculation lines, verdicts and the histogram summary, built from an API-shaped answer
import { calcBlock, blockHeading, histogramSummary } from './calc.js'
const H17_CAP = { mean: 0.5, sigma_hat: 0.02, lsl: -0.1, usl: 0.1, cpl: 1.8, cpu: 1.7, cp: 1.75, cpk: 1.7, reliable: true, capable: true, message: null, histogram: { edges: [0, 1], counts: [3], n: 3, n_builds: 1 } }
const H17_CHARTS = { r: { cl: 0.05 } }
const H17_SETTINGS = { capable_min_index: 1.33, subgroup_size: 5, constants: { d2: 2.326 } }
function calcTexts() {
  const out = []
  const variants = [
    H17_CAP,
    { ...H17_CAP, lsl: null, cpl: null, cp: null },
    { ...H17_CAP, usl: null, cpu: null, cp: null },
    { ...H17_CAP, capable: false, cpk: 1.2 },
    { ...H17_CAP, reliable: false, capable: false },
    { ...H17_CAP, sigma_hat: 0, cpl: null, cpu: null, cp: null, cpk: null, capable: null, message: 'zero within-build variation: capability indices are undefined' },
  ]
  for (const q of QUALITY) {
    out.push(blockHeading(q), histogramSummary(q, H17_CAP))
    for (const cap of variants) {
      const b = calcBlock(q, { capability: { [q.key]: cap }, charts: { [q.key]: H17_CHARTS }, settings: H17_SETTINGS })
      b.steps.forEach((s) => out.push(s.title, s.words, s.math))
      out.push(b.verdict, b.message)
    }
  }
  return out.filter((t) => typeof t === 'string')
}

describe('capital letter after a colon in the displayed text', () => {
  const shown = []
  const add = (v) => { if (typeof v === 'string') shown.push(v); else if (Array.isArray(v)) v.forEach(add); else if (v && typeof v === 'object') Object.values(v).forEach(add) }
  add(TEXT); add(QUALITY.map((q) => q.indexName)); add(LEGEND_RULES); add(CHART_HELP); add(UNRELIABLE_TEXT)
  add(DATASET_TEXT); add(COLUMN_MEANINGS); add(TOUR_STEPS)
  // The legend joins a bold word, a colon and these sentences in App.jsx, so scan them as they render.
  add(`QUARANTINE: ${TEXT.quarantine}`); add(`RELEASE: ${TEXT.release}`)
  for (const k of ['xbar', 'r', 'i', 'mr']) add(chartTitle(k, 'Tensile strength', 'MPa'))
  for (const r of ['uts X-bar rule 5', 'porosity R rule 1']) add(explainRule(r))
  for (const n of [
    'uts_MPa: baseline coupons look non-normal (Shapiro-Wilk p = 0.012); indices are approximate',
    'porosity_pct: porosity is bounded at 0 and skewed, so Cpu is approximate',
    'chamber_oxygen_ppm: zero baseline sigma (the parameter did not vary in the baseline): skipped',
    'uts_MPa: only 12 builds (fewer than baseline_n=20): limits use all 12 builds',
    'uts_MPa: limits use the first 20 builds (baseline)',
    'uts_MPa: baseline has no variation',
  ]) add(plainNote(n))
  for (const m of [
    'missing required columns: uts_MPa', 'build B-1 has 4 coupons; each build needs exactly 5',
    "column 'uts_MPa' has non-numeric text, for example '95 MPa'", "column 'uts_MPa' has an infinite value",
    "column 'uts_MPa' contains True/False values", "column 'uts_MPa' contains dates or times",
    "column 'uts_MPa' appears 2 times in the header", 'the file has a header but no data rows',
    "column 'uts_MPa' has 2 blank or missing values", 'build_timestamp is not a valid date',
    'could not read the upload as a CSV', 'need at least 2 builds',
  ]) add(explainUploadError(m))
  add(summarySentence({ builds: [{ build_id: 'B-1', disposition: 'QUARANTINE', investigate_first: [{ parameter: 'chamber_oxygen_ppm', z: 3, rules: [] }] }], first_out_of_control_build: 'B-1', process_capable: false }))

  const below = { process_capable: false, first_out_of_control_build: null, builds: [], settings: { capable_min_index: 1.33 }, capability: { dimensional_dev_mm: { cpk: 1.19, reliable: true, capable: false } } }
  add(summarySentence(below))
  add(capabilityRow({ cpk: 1.19, reliable: true, capable: false }, 'cpk', 1.33).statusText)
  add(capabilityRow({ cpk: 1.9, reliable: true, capable: true }, 'cpk', 1.33).statusText)
  add(calcTexts())
  // H-19: every sentence of the Possible Causes section, as it renders (also the null-factors note and the tour steps' text above)
  for (const f of [null, ...factorVariants()]) add(causesTexts(f, QUALITY))

  it('has strings to scan', () => {
    expect(shown.length).toBeGreaterThan(60)
  })
  it('never has a lowercase letter right after a colon and a space', () => {
    const bad = shown.filter((s) => /: [a-z]/.test(s.replace(/: [a-z]+_[A-Za-z_]+/g, ': COLUMN'))) // a column name such as uts_MPa keeps its spelling
    expect(bad).toEqual([])
  })
})

describe('few baseline builds note', () => {
  it('turns the API warning into plain words with a capital after each colon', () => {
    expect(plainNote('few baseline builds (3): the control limits are rough, so the rules can raise false alarms; use at least 10 builds when you can (20 or more is best)'))
      .toBe('Few baseline builds (3): The control limits are rough, so the rules can raise false alarms. Use at least 10 builds when you can (20 or more is best).')
  })
})

import { describe, it, expect } from 'vitest'
import {
  PARAM_NAMES, CHART_HELP, SPEC_FIELDS, RULE_PHRASES, UNRELIABLE_TEXT, COLUMN_MEANINGS, DATASET_TEXT,
  explainUploadError, explainRule, plainNote, summarySentence, capabilityRow, chartTitle, errorText, DIM_GROUP, validateSpecs,
} from './format.js'
import { TOUR_STEPS } from './tour.js'
import { QUALITY, PARAMS, LEGEND_RULES, TEXT } from './labels.js'

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

// GUARD, not proof. It looks for short forms that a reader outside the course would not know.
//
// Rule: a short form may appear only inside a parenthesis that directly follows the plain words
// ("Tensile strength (UTS)", "spreadsheet file (CSV)"). So we first cut out every "(...)" that
// follows a word, then look for the banned forms in what is left.
//   - PAREN_ONLY forms are allowed inside such a parenthesis.
//   - NEVER forms are not allowed anywhere in visible text.
// Identifiers such as uts_MPa or chamber_oxygen_ppm are column names the user must type; they have
// underscores, so the word-boundary regexes below do not match inside them.

const PAREN_ONLY = ['LSL', 'USL', 'UCL', 'LCL', 'CL', 'UTS', 'CSV', 'API', 'Cpl', 'Cpu', 'Cpk']
const NEVER = ['e.g.', 'vs.', 'vs', 'approx', 'pct', 'n/a', 'min', 'max', 'dev', 'spec']

function containsWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}($|[^A-Za-z0-9_])`).test(text)
}

// The team asked for every unit as its symbol: MPa, %, mm, ppm, W, mm/s, µm and °C are allowed everywhere.
const CONTROL_LABELS = SPEC_FIELDS.map((f) => f.label)

/** A sentence that quotes the control labels (a validation message): check it with the labels cut out. */
function withoutControlLabels(text) {
  return [...CONTROL_LABELS].sort((a, b) => b.length - a.length).reduce((t, l) => t.split(l).join('the box'), String(text))
}

function offenders(text) {
  const t = String(text)
  const withoutParens = t.replace(/(?<=[A-Za-z])\s\([^)]*\)/g, ' ')
  return [...PAREN_ONLY, ...NEVER].filter((w) => containsWord(withoutParens, w))
}

function flatten(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => flatten(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => flatten(v, out))
  return out
}

describe('the guard itself', () => {
  it('allows a short form inside a parenthesis after plain words', () => {
    expect(offenders('Tensile strength (UTS), in units of pressure (MPa)')).toEqual([])
    expect(offenders('spreadsheet file (CSV)')).toEqual([])
    expect(offenders('lower specification limit (LSL)')).toEqual([])
  })
  it('catches bare short forms', () => {
    expect(offenders('UTS LSL (MPa)')).toEqual(expect.arrayContaining(['UTS', 'LSL']))
    expect(offenders('Upload your CSV')).toContain('CSV')
    expect(offenders('about 15 pct, approx, e.g. this')).toEqual(expect.arrayContaining(['pct', 'approx', 'e.g.']))
    expect(offenders('speed in mm/s and 100 ppm')).toEqual([]) // unit symbols are allowed
    expect(offenders('n/a')).toContain('n/a')
  })
  it('does not trip on column names', () => {
    expect(offenders('uts_MPa, chamber_oxygen_ppm and scan_speed_mm_s')).toEqual([])
  })
  it('allows unit symbols everywhere', () => {
    for (const label of CONTROL_LABELS) expect(offenders(label)).toEqual([])
    expect(offenders('Porosity is about 0.2 % here, 15 mm, 280 W, 100 ppm, 35 °C, 1200 mm/s, 30 µm, 950 MPa')).toEqual([])
  })
  it('the four control labels are the Title Case form with the unit in parentheses', () => {
    expect(CONTROL_LABELS).toEqual([
      'Tensile Strength: Lowest Allowed (MPa)',
      'Porosity: Highest Allowed (%)',
      'Dimensional Deviation: Lowest Allowed (mm)',
      'Dimensional Deviation: Highest Allowed (mm)',
    ])
  })
})

describe('visible-string constants use plain words', () => {
  const groups = {
    PARAM_NAMES, CHART_HELP, RULE_PHRASES, UNRELIABLE_TEXT, COLUMN_MEANINGS, DATASET_TEXT,
    SPEC_LABELS: CONTROL_LABELS,
    SPEC_SHORT_LABELS: SPEC_FIELDS.map((f) => f.short ?? ''),
    DIM_GROUP: [DIM_GROUP],
    TOUR_STEPS, LEGEND_RULES, TEXT,
    QUALITY: QUALITY.map((q) => [q.title, q.unit, q.indexName]),
    PARAMS: Object.values(PARAMS).map((p) => [p.title, p.unit]),
  }
  for (const [name, value] of Object.entries(groups)) {
    it(`${name} has no bare short forms`, () => {
      const bad = flatten(value).map((t) => [t, offenders(t)]).filter(([, o]) => o.length)
      expect(bad).toEqual([])
    })
  }

  it('the calculation steps, verdicts and histogram summary have none', () => {
    const bad = calcTexts().map((t) => [t, offenders(t)]).filter(([, o]) => o.length)
    expect(bad).toEqual([])
  })

  it('chart titles, rule sentences, notes, upload hints and summaries have none', () => {
    const texts = []
    for (const kind of ['xbar', 'r', 'i', 'mr']) texts.push(chartTitle(kind, 'Tensile strength', 'MPa'))
    for (const key of ['uts', 'porosity', 'dimensional']) {
      for (let k = 1; k <= 8; k++) texts.push(explainRule(`${key} X-bar rule ${k}`))
      texts.push(explainRule(`${key} R rule 1`))
    }
    texts.push(
      plainNote('zero within-build variation: capability indices are undefined'),
      plainNote('a chart is out of control: capability indices are printed but not reliable'),
      plainNote('porosity_pct: porosity is bounded at 0 and skewed, so Cpu is approximate'),
      errorText(500, null),
    )
    texts.push(
      explainUploadError('HTTP 422: missing required columns: uts_MPa'),
      explainUploadError('build B-1 has 4 coupons; each build needs exactly 5 coupons'),
      explainUploadError("column 'uts_MPa' has non-numeric text, for example 'about 950' in row 4"),
      explainUploadError("column 'porosity_pct' has 2 blank or missing values"),
      explainUploadError('build_timestamp is not a valid date/time'),
      explainUploadError('could not read the upload as a CSV file'),
      explainUploadError('need at least 2 builds'),
    )
    // validation messages quote the control labels; with those cut out the rest must be plain
    const ok = { uts_lsl: '900', porosity_usl: '0.5', dim_lsl: '-0.1', dim_usl: '0.1' }
    const messages = [
      validateSpecs({ ...ok, uts_lsl: 'abc' }).message,
      validateSpecs({ ...ok, porosity_usl: 'abc' }).message,
      validateSpecs({ ...ok, dim_lsl: '0.2' }).message,
    ]
    texts.push(...messages.map(withoutControlLabels))
    const builds = [{ build_id: 'B-1', disposition: 'QUARANTINE', investigate_first: [{ parameter: 'laser_power_W', z: 3, rules: [1] }] }]
    texts.push(summarySentence({ process_capable: false, first_out_of_control_build: 'B-1', builds }))
    texts.push(summarySentence({ process_capable: true, first_out_of_control_build: null, builds: [] }))
    texts.push(summarySentence({ process_capable: false, first_out_of_control_build: null, builds: [], settings: { capable_min_index: 1.33 }, capability: { dimensional_dev_mm: { cpk: 1.19, reliable: true, capable: false } } }))
    texts.push(capabilityRow({ cpk: 1.19, reliable: true, capable: false }, 'cpk', 1.33).statusText)
    texts.push(capabilityRow({ cpk: 1.9, reliable: true, capable: true }, 'cpk', 1.33).statusText)
    const bad = texts.map((t) => [t, offenders(t)]).filter(([, o]) => o.length)
    expect(bad).toEqual([])
  })
})

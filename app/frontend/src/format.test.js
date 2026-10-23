import { describe, it, expect } from 'vitest'
import {
  fmt, fmtTime, shortBuild, errorText, topSuspect, suspectText,
  perPointRules, listToPerPoint, capabilityRow, mrProps,
  friendlyParam, summarySentence, validateSpecs, analysisQuery, specDefaults, isUnreliable, CHART_HELP,
  datasetLabel, SPEC_FIELDS, DIM_GROUP, REPO_URL, baselineChange, DEFAULT_BASELINE, BASELINE_MIN,
} from './format.js'
import { TEXT } from './labels.js'

describe('fmt', () => {
  it('shows a missing index as not available', () => {
    expect(fmt(null)).toBe('not available')
    expect(fmt(undefined)).toBe('not available')
    expect(fmt(NaN)).toBe('not available')
  })
  it('rounds to the requested decimals', () => {
    expect(fmt(4.6351490435, 2)).toBe('4.64')
    expect(fmt(0.20728, 3)).toBe('0.207')
    expect(fmt(12, 1)).toBe('12.0')
  })
})

describe('small formatters', () => {
  it('time and build id', () => {
    expect(fmtTime('2026-02-18T08:00:00')).toBe('2026-02-18 08:00')
    expect(shortBuild('B-1023')).toBe('1023')
  })
  it('errors keep the API detail text', () => {
    expect(errorText(422, { detail: 'build B-1 has 4 coupons' })).toBe('HTTP 422: build B-1 has 4 coupons')
    expect(errorText(422, { detail: [{ msg: 'must be >= 5' }] })).toBe('HTTP 422: must be >= 5')
    expect(errorText(500, null)).toBe('HTTP 500: the analysis service gave no details')
  })
})

describe('top suspect', () => {
  const build = { investigate_first: [{ parameter: 'chamber_oxygen_ppm', z: 9.438, rules: [1, 5] }] }
  it('takes the first (largest |z|) entry the API sent', () => {
    expect(topSuspect(build).parameter).toBe('chamber_oxygen_ppm')
    expect(suspectText(build)).toBe('chamber oxygen (parts per million): 9.4 standard deviations above the center line')
    expect(suspectText({ investigate_first: [{ parameter: 'laser_power_W', z: -37.04, rules: [1] }] }))
      .toBe('laser power (watts): 37.0 standard deviations below the center line')
  })
  it('is a dash when there is none', () => {
    expect(topSuspect({ investigate_first: [] })).toBeNull()
    expect(suspectText({ investigate_first: [] })).toBe('-')
  })
})

describe('flag mapping', () => {
  it('turns rule -> indices into rules per point', () => {
    const rules = perPointRules({ 1: [2], 5: [2, 3], 2: [] }, 4)
    expect(rules).toEqual([[], [], [1, 5], [5]])
  })
  it('a list of indices means rule 1', () => {
    expect(listToPerPoint([1], 3)).toEqual([[], [1], []])
  })
  it('moving range chart gets a leading empty point', () => {
    const p = mrProps({ moving_ranges: [2, 9], mr_bar: 5, mr_ucl: 8, mr_flags: [2] })
    expect(p.values).toEqual([null, 2, 9])
    expect(p.rules).toEqual([[], [], [1]])
    expect(p.lcl).toBe(0)
  })
})

describe('capabilityRow', () => {
  it('null index -> not available with the API message in plain words', () => {
    const row = capabilityRow({ cpl: null, reliable: true, capable: false, message: 'zero within-build variation: capability indices are undefined' }, 'cpl')
    expect(row.text).toBe('not available')
    expect(row.message).toBe('There is no variation inside the builds, so the capability indices are undefined.')
  })
  it('chart out of control: no reliability line at all, the warning stays', () => {
    const row = capabilityRow({ cpl: 4.6351, reliable: false, capable: false }, 'cpl', 1.33)
    expect(row.statusText).toBeNull()
    expect(row.status).toBe('unreliable')
    expect(row.unreliable).toBe(true)
    expect(JSON.stringify(row)).not.toMatch(/[Nn]ot reliable/)
  })
  it('in control and at or above the minimum: Meets the minimum', () => {
    const row = capabilityRow({ cpl: 4.6351, reliable: true, capable: true }, 'cpl', 1.33)
    expect(row.text).toBe('4.64')
    expect(row.status).toBe('meets')
    expect(row.statusText).toBe('Meets the minimum of 1.33')
  })
  it('in control and below the minimum: Below the minimum, Not capable', () => {
    const row = capabilityRow({ cpk: 1.19, reliable: true, capable: false }, 'cpk', 1.33)
    expect(row.status).toBe('below')
    expect(row.statusText).toBe('Below the minimum of 1.33: Not capable')
    expect(row.unreliable).toBe(false)
  })
  it('the minimum in the text comes from the settings', () => {
    expect(capabilityRow({ cpk: 1.6, reliable: true, capable: false }, 'cpk', 2).statusText).toBe('Below the minimum of 2.00: Not capable')
  })
  it('no index: no status line, the message stays', () => {
    const row = capabilityRow({ cpl: null, reliable: true, capable: false, message: 'zero within-build variation: capability indices are undefined' }, 'cpl', 1.33)
    expect(row.statusText).toBeNull()
    expect(row.message).toContain('undefined')
  })
})

describe('chartsIntro is a list of four short bullets', () => {
  it('has four items, none of them one long paragraph', () => {
    expect(Array.isArray(TEXT.chartsIntro)).toBe(true)
    expect(TEXT.chartsIntro).toHaveLength(4)
    expect(TEXT.chartsIntro[0]).toBe('Blue shading: Baseline builds used to calculate the limits.')
    expect(TEXT.chartsIntro.every((t) => t.length < 100)).toBe(true)
  })
})

describe('unreliable indices', () => {
  it('a number with reliable:false is flagged; a null index and a reliable one are not', () => {
    expect(isUnreliable({ cpl: 4.6, reliable: false }, 'cpl')).toBe(true)
    expect(isUnreliable({ cpl: 4.6, reliable: true }, 'cpl')).toBe(false)
    expect(isUnreliable({ cpl: null, reliable: false }, 'cpl')).toBe(false)
    expect(capabilityRow({ cpl: 4.6, reliable: false }, 'cpl').unreliable).toBe(true)
  })
})

describe('friendlyParam', () => {
  it('uses plain names, and falls back to the column name', () => {
    expect(friendlyParam('chamber_oxygen_ppm')).toBe('chamber oxygen (parts per million)')
    expect(friendlyParam('laser_power_W')).toBe('laser power (watts)')
    expect(friendlyParam('scan_speed_mm_s')).toBe('scan speed (millimeters per second)')
    expect(friendlyParam('layer_thickness_um')).toBe('layer thickness (micrometers)')
    expect(friendlyParam('humidity_pct')).toBe('humidity (percent)')
    expect(friendlyParam('powder_bed_temp_C')).toBe('powder bed temperature (degrees Celsius)')
    expect(friendlyParam('build_plate_temp_C')).toBe('build plate temperature (degrees Celsius)')
    expect(friendlyParam('stress_relief_temp_C')).toBe('stress relief temperature (degrees Celsius)')
    expect(friendlyParam('mystery_col')).toBe('mystery_col')
  })
})

describe('summarySentence', () => {
  const rel = (n) => Array.from({ length: n }, (_, i) => ({ build_id: `B-${1001 + i}`, disposition: 'RELEASE', investigate_first: [] }))
  const swap = (builds, from, count, disposition, suspect) =>
    builds.map((b, i) => (i >= from && i < from + count
      ? { ...b, disposition, investigate_first: suspect ? [{ parameter: suspect, z: 9, rules: [1] }] : [] }
      : b))

  it('capable: everything is released', () => {
    const r = { process_capable: true, first_out_of_control_build: null, builds: rel(30) }
    expect(summarySentence(r)).toBe('All 30 builds are in control and capable. Every build can be released.')
  })
  it('out of control with a suspect: first build, count, friendly cause', () => {
    const r = { process_capable: false, first_out_of_control_build: 'B-1023', builds: swap(rel(30), 22, 8, 'QUARANTINE', 'chamber_oxygen_ppm') }
    expect(summarySentence(r)).toBe(
      'From build B-1023 the process went out of control; 8 builds should be quarantined. Most likely cause: Chamber oxygen (parts per million).')
  })
  it('one quarantined build reads in the singular', () => {
    const r = { process_capable: false, first_out_of_control_build: 'B-1024', builds: swap(rel(30), 23, 1, 'QUARANTINE', 'laser_power_W') }
    expect(summarySentence(r)).toBe(
      'From build B-1024 the process went out of control; 1 build should be quarantined. Most likely cause: Laser power (watts).')
  })
  it('out of control with no suspect', () => {
    const r = { process_capable: false, first_out_of_control_build: 'B-1005', builds: swap(rel(30), 4, 2, 'QUARANTINE', null) }
    expect(summarySentence(r)).toBe(
      'From build B-1005 the process went out of control; 2 builds should be quarantined. No build parameter stands out as the cause.')
  })
  it('retest only, not capable: no rule broken', () => {
    const r = { process_capable: false, first_out_of_control_build: null, builds: swap(rel(30), 10, 3, 'RETEST', null) }
    expect(summarySentence(r)).toBe(
      'No build broke a rule, but the process is not shown to be capable of the specification. 3 builds have a coupon outside the specification and should be retested.')
  })
  it('retest only, capable', () => {
    const r = { process_capable: true, first_out_of_control_build: null, builds: swap(rel(30), 10, 1, 'RETEST', null) }
    expect(summarySentence(r)).toBe(
      'The process is in control and capable. 1 build has a coupon outside the specification and should be retested.')
  })
  it('in control but one index below the minimum: names the measure', () => {
    const cap = {
      uts_MPa: { cpl: 4.8, reliable: true, capable: true },
      porosity_pct: { cpu: 3.7, reliable: true, capable: true },
      dimensional_dev_mm: { cpk: 1.19, reliable: true, capable: false },
    }
    const r = { process_capable: false, first_out_of_control_build: null, builds: rel(30), capability: cap, settings: { capable_min_index: 1.33 } }
    expect(summarySentence(r)).toBe(
      'No build broke a rule, but Dimensional deviation is below the minimum of 1.33, so the process is not shown to be capable.')
  })
  it('two measures below the minimum', () => {
    const cap = {
      uts_MPa: { cpl: 1.1, reliable: true, capable: false },
      porosity_pct: { cpu: 1.0, reliable: true, capable: false },
      dimensional_dev_mm: { cpk: 2, reliable: true, capable: true },
    }
    const r = { process_capable: false, first_out_of_control_build: null, builds: rel(3), capability: cap, settings: { capable_min_index: 1.33 } }
    expect(summarySentence(r)).toContain('Tensile strength and Porosity are below the minimum of 1.33')
  })
  it('not capable, nothing to retest', () => {
    const r = { process_capable: false, first_out_of_control_build: null, builds: rel(30) }
    expect(summarySentence(r)).toBe('No build broke a rule, but the process is not shown to be capable of the specification.')
  })
  it('quarantine and retest together', () => {
    const b = swap(swap(rel(30), 22, 2, 'QUARANTINE', 'chamber_oxygen_ppm'), 5, 1, 'RETEST', null)
    const r = { process_capable: false, first_out_of_control_build: 'B-1023', builds: b }
    expect(summarySentence(r)).toBe(
      'From build B-1023 the process went out of control; 2 builds should be quarantined and 1 build retested. Most likely cause: Chamber oxygen (parts per million).')
  })
})

describe('spec limit boxes', () => {
  const ok = { uts_lsl: '900', porosity_usl: '0.5', dim_lsl: '-0.1', dim_usl: '0.1' }
  it('reads the defaults from /spec-limits', () => {
    const limits = { specs: { uts_MPa: { lsl: 900, usl: null }, porosity_pct: { lsl: null, usl: 0.5 }, dimensional_dev_mm: { lsl: -0.1, usl: 0.1 } } }
    expect(specDefaults(limits)).toEqual(ok)
  })
  it('accepts good numbers and blanks', () => {
    expect(validateSpecs(ok).ok).toBe(true)
    expect(validateSpecs({ ...ok, uts_lsl: '' }).ok).toBe(true)
  })
  it('rejects text, Infinity and NaN', () => {
    expect(validateSpecs({ ...ok, uts_lsl: 'abc' }).message).toBe('Tensile Strength: Lowest Allowed (MPa) must be a number (got "abc").')
    expect(validateSpecs({ ...ok, porosity_usl: 'Infinity' }).message).toContain('Porosity: Highest Allowed (%)')
    expect(validateSpecs({ ...ok, dim_usl: 'NaN' }).message).toContain('Dimensional Deviation: Highest Allowed (mm)')
    expect(validateSpecs({ ...ok, dim_lsl: 'x' }).message).toContain('Dimensional Deviation: Lowest Allowed (mm)')
  })
  it('rejects dimensional LSL >= USL, quoting the two control labels', () => {
    expect(validateSpecs({ ...ok, dim_lsl: '0.2' }).message).toBe(
      'Dimensional Deviation: Lowest Allowed (mm) must be below Dimensional Deviation: Highest Allowed (mm).')
    expect(validateSpecs({ ...ok, dim_lsl: '0.1' }).ok).toBe(false)
  })
  it('query string has baseline_n and only the non-blank limits', () => {
    expect(analysisQuery(20, { uts_lsl: '990', porosity_usl: '', dim_lsl: '', dim_usl: '' })).toBe('baseline_n=20&uts_lsl=990')
    expect(analysisQuery(10, ok)).toBe('baseline_n=10&uts_lsl=900&porosity_usl=0.5&dim_lsl=-0.1&dim_usl=0.1')
  })
})

// ---- H-12: controls panel wording ----
describe('datasetLabel', () => {
  it('drops underscores and capitalises every word', () => {
    expect(datasetLabel('capable_baseline')).toBe('Capable Baseline')
    expect(datasetLabel('oxygen_drift')).toBe('Oxygen Drift')
    expect(datasetLabel('laser_power_excursion')).toBe('Laser Power Excursion')
    expect(datasetLabel('marginal_spread')).toBe('Marginal Spread')
  })
  it('handles empty input', () => {
    expect(datasetLabel('')).toBe('')
    expect(datasetLabel(null)).toBe('')
    expect(datasetLabel(undefined)).toBe('')
  })
  it('handles extra underscores and spaces', () => {
    expect(datasetLabel('__oxygen___drift_')).toBe('Oxygen Drift')
    expect(datasetLabel(' oxygen_drift ')).toBe('Oxygen Drift')
    expect(datasetLabel('_')).toBe('')
  })
  it('keeps letters that are already capitals, and single words', () => {
    expect(datasetLabel('Capable_Baseline')).toBe('Capable Baseline')
    expect(datasetLabel('NASA_run')).toBe('NASA Run')
    expect(datasetLabel('pilot')).toBe('Pilot')
    expect(datasetLabel('run_2')).toBe('Run 2')
  })
})

describe('control labels', () => {
  it('are exactly the team-requested strings, in the order they are shown', () => {
    expect(SPEC_FIELDS.map((f) => f.label)).toEqual([
      'Tensile Strength: Lowest Allowed (MPa)',
      'Porosity: Highest Allowed (%)',
      'Dimensional Deviation: Lowest Allowed (mm)',
      'Dimensional Deviation: Highest Allowed (mm)',
    ])
    expect(SPEC_FIELDS.map((f) => f.name)).toEqual(['uts_lsl', 'porosity_usl', 'dim_lsl', 'dim_usl'])
  })
  it('the two dimensional boxes share one group heading and short labels', () => {
    expect(DIM_GROUP).toBe('Dimensional Deviation')
    const dims = SPEC_FIELDS.filter((f) => f.group)
    expect(dims.map((f) => f.short)).toEqual(['Lowest Allowed (mm)', 'Highest Allowed (mm)'])
    for (const f of dims) expect(f.label).toBe(`${DIM_GROUP}: ${f.short}`)
  })
  it('the page words are exact', () => {
    expect(TEXT.datasetLabel).toBe('Select an example dataset')
    expect(TEXT.fileLabel).toBe('Upload dataset')
    expect(TEXT.datasetHeading).toBe('Dataset')
    expect(TEXT.parametersHeading).toBe('Parameters')
    expect(TEXT.baselineLabel).toBe('Baseline builds')
    expect(TEXT.githubLabel).toBe('GitHub repository')
    expect(TEXT.subtitle).toBeUndefined()
    expect(REPO_URL).toBe('https://github.com/sean-zhen674/six-sigma-hackathon-sean-sam-parker')
  })
  it('the baseline helper explains the baseline in plain words', () => {
    expect(TEXT.baselineHelp).toBe(
      'How many of the earliest builds are used to learn what normal looks like. The control limits are calculated from these builds, and every later build is compared against them. Default: 20, minimum: 5.')
  })
})

describe('chart help text', () => {
  it('has one short line for each chart kind', () => {
    for (const k of ['xbar', 'r', 'i', 'mr']) expect(CHART_HELP[k].length).toBeLessThan(170)
    expect(CHART_HELP.xbar).toContain('Red diamonds')
  })
})

// ---- H-10: friendlier upload errors ----
import { explainUploadError, REQUIRED_COLUMNS, OPTIONAL_COLUMNS } from './format.js'

describe('explainUploadError', () => {
  it('explains missing columns and names them', () => {
    const hint = explainUploadError('HTTP 422: missing required columns: uts_MPa, porosity_pct')
    expect(hint).toContain('uts_MPa, porosity_pct')
    expect(hint).toContain('header must match exactly')
  })

  it('explains a wrong coupon count with the build and the count', () => {
    const hint = explainUploadError('build B-1007 has 4 coupons; each build needs exactly 5 coupons')
    expect(hint).toContain('Build B-1007 has 4 coupon rows')
    expect(hint).toContain('exactly 5')
    expect(explainUploadError('build B-1 has 1 coupon; each build needs exactly 5 coupons')).toContain('1 coupon row,')
  })

  it('explains non-numeric text with the column and the value', () => {
    const hint = explainUploadError("column 'uts_MPa' has non-numeric text, for example '950 MPa' in row 4 of the file; use plain numbers without units")
    expect(hint).toContain('uts_MPa')
    expect(hint).toContain('950 MPa')
    expect(hint).toContain('No units')
  })

  it('explains blank cells with the column and the count', () => {
    const hint = explainUploadError("column 'porosity_pct' has 2 blank or missing values (first in row 5 of the file); fill them in or delete those rows")
    expect(hint).toContain('porosity_pct')
    expect(hint).toContain('2 empty cells')
    expect(explainUploadError("column 'porosity_pct' has 1 blank or missing values")).toContain('1 empty cell.')
  })

  it('explains a bad timestamp with the expected form', () => {
    const hint = explainUploadError("HTTP 422: build_timestamp is not a valid date/time (for example 'last Tuesday'); use a form like 2026-01-05T08:00:00")
    expect(hint).toContain('2026-01-05T08:00:00')
  })

  it('explains an unreadable file', () => {
    expect(explainUploadError('HTTP 422: could not read the upload as a CSV file: Error tokenizing data')).toContain('comma-separated UTF-8')
  })

  it('explains too few builds', () => {
    expect(explainUploadError('HTTP 422: need at least 2 builds to draw a control chart')).toContain('at least 2 builds')
  })

  it('returns null for an unknown message and for empty input', () => {
    expect(explainUploadError('HTTP 500: something odd')).toBeNull()
    expect(explainUploadError('')).toBeNull()
    expect(explainUploadError(undefined)).toBeNull()
  })

  it('lists 5 required and 8 optional columns', () => {
    expect(REQUIRED_COLUMNS).toHaveLength(5)
    expect(OPTIONAL_COLUMNS).toHaveLength(8)
  })
})

// ---- H-13: layout round 2 ----
describe('H-13 words', () => {
  it('the popup button, popup title and reset hint are exact', () => {
    expect(TEXT.csvButton).toBe('How should my file be formatted?')
    expect(TEXT.csvTitle).toBe('Spreadsheet file (CSV) format')
    expect(TEXT.updateCharts).toBe('Update charts')
    expect(TEXT.resetHint).toBe('Puts the four allowed values back and sets Baseline builds back to 20.')
    expect(TEXT.glossary).toBeUndefined()
    expect(TEXT.limitsHint).toBeUndefined()
    expect(TEXT.baselineHelp).toContain('Default: 20, minimum: 5.')
    expect(TEXT.noParams).not.toMatch(/panel above/)
  })
})

describe('baselineChange (Enter, blur and the Update charts button all use it)', () => {
  it('constants', () => {
    expect(DEFAULT_BASELINE).toBe(20)
    expect(BASELINE_MIN).toBe(5)
  })
  it('a new valid whole number is applied', () => {
    expect(baselineChange(10, 20)).toEqual({ kind: 'apply', value: 10 })
    expect(baselineChange('10', 20)).toEqual({ kind: 'apply', value: 10 })
    expect(baselineChange(5, 20)).toEqual({ kind: 'apply', value: 5 })
  })
  it('the same value as the last run sends nothing', () => {
    expect(baselineChange(20, 20)).toEqual({ kind: 'unchanged' })
    expect(baselineChange('20', 20)).toEqual({ kind: 'unchanged' })
  })
  it('below 5, blank, not a number or not whole is invalid with a message', () => {
    for (const bad of [3, 4, 0, -2, '', 'abc', 7.5, NaN, null]) {
      const r = baselineChange(bad, 20)
      expect(r.kind).toBe('invalid')
      expect(r.message).toBe('Baseline builds must be a whole number of at least 5.')
    }
  })
})

import { describe, it, expect } from 'vitest'
import { blockHeading, calcBlock, histogramBins, histogramSummary } from './calc.js'
import { QUALITY } from './labels.js'

// A small result shaped like the API's answer (numbers are capable_baseline at 20 baseline builds).
const settings = { capable_min_index: 1.33, subgroup_size: 5, constants: { d2: 2.326 } }
const uts = QUALITY[0]
const porosity = QUALITY[1]
const dim = QUALITY[2]
const cap = {
  uts_MPa: { mean: 973.043, sigma_hat: 5.062338779019779, lsl: 900.0, usl: null, cpl: 4.809568803963197, cpu: null, cp: null, cpk: 4.809568803963197, reliable: true, capable: true, message: null,
    histogram: { edges: [939, 943, 947, 951, 955, 959], counts: [1, 3, 3, 4, 4], n: 15, n_builds: 3 } },
  porosity_pct: { mean: 0.21355, sigma_hat: 0.02583834909716251, lsl: null, usl: 0.5, cpl: null, cpu: 3.6954115363283413, cp: null, cpk: 3.6954115363283413, reliable: true, capable: true, message: null, histogram: null },
  dimensional_dev_mm: { mean: 0.00037, sigma_hat: 0.018529664660361135, lsl: -0.1, usl: 0.1, cpl: 1.8055732405259088, cpu: 1.7922612529002322, cp: 1.7989172467130705, cpk: 1.7922612529002322, reliable: true, capable: true, message: null, histogram: null },
}
const charts = { uts_MPa: { r: { cl: 11.775000000000006 } }, porosity_pct: { r: { cl: 0.0601 } }, dimensional_dev_mm: { r: { cl: 0.0431 } } }
const result = (over = {}) => ({ capability: { ...cap, ...over }, charts, settings })

describe('calcBlock: one-sided tensile strength', () => {
  const block = calcBlock(uts, result())
  it('has the steps in order, only for the indices that exist', () => {
    expect(block.steps.map((s) => s.title)).toEqual([
      'Process average',
      'Average range (R-bar)',
      'Within-build standard deviation (sigma-hat)',
      'Capability index for the lower limit (Cpl)',
      'Capability index for the nearest limit (Cpk)',
    ])
  })
  it('shows the real numbers and reproduces the index', () => {
    const math = block.steps.map((s) => s.math)
    expect(math[0]).toBe('973.04 MPa')
    expect(math[1]).toBe('11.78 MPa')
    expect(math[2]).toBe('11.78 / 2.326 = 5.06 MPa')
    expect(math[3]).toBe('(973.04 − 900.0) / (3 × 5.06) = 4.81')
    expect(math[4]).toBe('4.81')
  })
  it('the verdict repeats the API decision in words', () => {
    expect(block.verdict).toBe('4.81 is at least the minimum of 1.33: Meets the minimum')
  })
})

describe('calcBlock: other shapes', () => {
  it('porosity has the upper index only', () => {
    const titles = calcBlock(porosity, result()).steps.map((s) => s.title)
    expect(titles).toContain('Capability index for the upper limit (Cpu)')
    expect(titles).not.toContain('Capability index for the lower limit (Cpl)')
    expect(titles).not.toContain('Capability index for the width between the limits (Cp)')
    expect(calcBlock(porosity, result()).steps.find((s) => s.title.includes('Cpu')).math).toBe('(0.500 − 0.2135) / (3 × 0.0258) = 3.70')
  })
  it('two limits give Cpl, Cpu, Cp and Cpk; a negative limit is wrapped in a bracket', () => {
    const block = calcBlock(dim, result())
    expect(block.steps.map((s) => s.math).slice(3)).toEqual([
      '(0.0004 − (−0.100)) / (3 × 0.0185) = 1.81',
      '(0.100 − 0.0004) / (3 × 0.0185) = 1.79',
      '(0.100 − (−0.100)) / (6 × 0.0185) = 1.80',
      'smaller of (1.81, 1.79) = 1.79',
    ])
  })
  it('below the minimum says Not capable', () => {
    const r = result({ dimensional_dev_mm: { ...cap.dimensional_dev_mm, cpk: 1.19, capable: false } })
    expect(calcBlock(dim, r).verdict).toBe('1.19 is below the minimum of 1.33: Not capable')
  })
  it('an out-of-control chart says the index does not count, without judging the number', () => {
    const r = result({ uts_MPa: { ...cap.uts_MPa, reliable: false, capable: false } })
    expect(calcBlock(uts, r).verdict).toBe('The index is 4.81 and the minimum is 1.33. The chart is out of control, so this index does not count.')
  })
  it('zero variation shows the service message, never a number', () => {
    const flat = { ...cap.uts_MPa, sigma_hat: 0, cpl: null, cpk: null, capable: null, message: 'zero within-build variation: capability indices are undefined' }
    const block = calcBlock(uts, { ...result({ uts_MPa: flat }), charts: { ...charts, uts_MPa: { r: { cl: 0 } } } })
    expect(block.steps.map((s) => s.title)).toEqual(['Process average', 'Average range (R-bar)', 'Within-build standard deviation (sigma-hat)'])
    expect(block.verdict).toBeNull()
    expect(block.message).toBe('There is no variation inside the builds, so the capability indices are undefined.')
    expect(JSON.stringify(block)).not.toMatch(/NaN|Infinity|not available/)
  })
})

describe('histogram helpers', () => {
  const h = cap.uts_MPa.histogram
  it('histogramBins pairs each count with its range', () => {
    expect(histogramBins(h)).toEqual([
      { from: 939, to: 943, count: 1 }, { from: 943, to: 947, count: 3 }, { from: 947, to: 951, count: 3 },
      { from: 951, to: 955, count: 4 }, { from: 955, to: 959, count: 4 },
    ])
  })
  it('a missing histogram gives no bins', () => {
    expect(histogramBins(null)).toEqual([])
  })
  it('the summary names the coupons, the process average and the limits', () => {
    const s = histogramSummary(uts, cap.uts_MPa)
    expect(s).toContain('Histogram of 15 coupons from 3 baseline builds')
    expect(s).toContain('Process average 973.0 MPa')
    expect(s).toContain('lowest allowed 900.0 MPa')
    expect(s).not.toContain('highest allowed')
  })
})

describe('blockHeading', () => {
  it('is the Title Case name with the unit symbol', () => {
    expect(QUALITY.map(blockHeading)).toEqual(['Tensile Strength (MPa)', 'Porosity (%)', 'Dimensional Deviation (mm)'])
  })
})

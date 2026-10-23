import { describe, it, expect } from 'vitest'
import {
  fmt, fmtTime, shortBuild, errorText, topSuspect, suspectText,
  perPointRules, listToPerPoint, capabilityRow, mrProps,
} from './format.js'

describe('fmt', () => {
  it('shows a missing index as n/a', () => {
    expect(fmt(null)).toBe('n/a')
    expect(fmt(undefined)).toBe('n/a')
    expect(fmt(NaN)).toBe('n/a')
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
    expect(errorText(500, null)).toBe('HTTP 500: the API gave no details')
  })
})

describe('top suspect', () => {
  const build = { investigate_first: [{ parameter: 'chamber_oxygen_ppm', z: 9.438, rules: [1, 5] }] }
  it('takes the first (largest |z|) entry the API sent', () => {
    expect(topSuspect(build).parameter).toBe('chamber_oxygen_ppm')
    expect(suspectText(build)).toBe('chamber_oxygen_ppm (z = 9.4)')
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
  it('null index -> n/a with the API message', () => {
    const row = capabilityRow({ cpl: null, reliable: true, capable: false, message: 'zero within-build variation' }, 'cpl')
    expect(row.text).toBe('n/a')
    expect(row.message).toBe('zero within-build variation')
  })
  it('labels reliability from the API flag', () => {
    expect(capabilityRow({ cpl: 4.6351, reliable: false, capable: false }, 'cpl').reliableLabel).toBe('not reliable (chart out of control)')
    expect(capabilityRow({ cpl: 4.6351, reliable: true, capable: true }, 'cpl').reliableLabel).toBe('reliable')
    expect(capabilityRow({ cpl: 4.6351, reliable: true, capable: true }, 'cpl').text).toBe('4.64')
  })
})

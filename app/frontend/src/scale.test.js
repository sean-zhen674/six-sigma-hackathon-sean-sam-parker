import { describe, it, expect } from 'vitest'
import { makeScale, xPosition, extent, chartDomain } from './scale.js'

describe('makeScale', () => {
  it('maps the domain ends to the range ends (y axis is flipped)', () => {
    const y = makeScale(0, 10, 200, 0)
    expect(y(0)).toBe(200)
    expect(y(10)).toBe(0)
    expect(y(5)).toBe(100)
  })
  it('a flat domain maps to the middle, not NaN', () => {
    expect(makeScale(3, 3, 0, 100)(3)).toBe(50)
  })
})

describe('xPosition', () => {
  it('first, last and middle points', () => {
    expect(xPosition(0, 5, 50, 450)).toBe(50)
    expect(xPosition(4, 5, 50, 450)).toBe(450)
    expect(xPosition(2, 5, 50, 450)).toBe(250)
  })
  it('a single point sits in the middle', () => {
    expect(xPosition(0, 1, 0, 100)).toBe(50)
  })
})

describe('known point position', () => {
  it('value 975 on domain 950-1000 over pixels 240..0, build 11 of 21', () => {
    const y = makeScale(950, 1000, 240, 0)
    expect(y(975)).toBe(120)
    expect(xPosition(10, 21, 60, 560)).toBe(310)
  })
})

describe('extent and chart domain', () => {
  it('extent ignores null', () => {
    expect(extent([null, 3, 1, 2])).toEqual([1, 3])
    expect(extent([null])).toBeNull()
  })
  it('chartDomain covers the points and the limits, plus 8 % padding', () => {
    const [lo, hi] = chartDomain([0.2, 0.22], [0.17, 0.24])
    expect(lo).toBeCloseTo(0.17 - 0.07 * 0.08, 10)
    expect(hi).toBeCloseTo(0.24 + 0.07 * 0.08, 10)
  })
  it('chartDomain with nothing to draw is [0, 1]', () => {
    expect(chartDomain([null], [])).toEqual([0, 1])
  })
})

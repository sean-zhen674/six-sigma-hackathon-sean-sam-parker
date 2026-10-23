import { describe, it, expect } from 'vitest'
import { makeScale, xPosition, extent, specVisible, chartDomain } from './scale.js'

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

describe('domain and spec visibility', () => {
  it('extent ignores null', () => {
    expect(extent([null, 3, 1, 2])).toEqual([1, 3])
    expect(extent([null])).toBeNull()
  })
  it('a spec far from the data is left out, a near one is kept', () => {
    const domain = [960, 985] // span 25
    expect(specVisible(900, domain)).toBe(false)
    expect(specVisible(950, domain)).toBe(true)
    expect(specVisible(null, domain)).toBe(false)
  })
  it('chartDomain includes visible specs only', () => {
    const near = chartDomain([0.2, 0.22], [0.17, 0.24], [0.28, 0.5])
    const far = chartDomain([970, 980], [966, 984], [900])
    expect(near[1]).toBeGreaterThan(0.28)
    expect(near[1]).toBeLessThan(0.5)
    expect(far[0]).toBeGreaterThan(900)
  })
})

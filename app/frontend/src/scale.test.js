import { describe, it, expect } from 'vitest'
import { makeScale, xPosition, extent, chartDomain, spreadLabels } from './scale.js'

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

// ---- H-17: histogram helpers ----
import { niceTicks, placeLineLabels } from './scale.js'

describe('niceTicks', () => {
  it('rounds to a friendly step inside the range', () => {
    expect(niceTicks(939, 959, 5)).toEqual([940, 945, 950, 955])
    expect(niceTicks(0.13, 0.3, 5)).toEqual([0.15, 0.2, 0.25, 0.3])
    expect(niceTicks(-0.1, 0.1, 5)).toEqual([-0.1, -0.05, 0, 0.05, 0.1])
  })
  it('a flat or reversed range gives just the value or nothing', () => {
    expect(niceTicks(5, 5, 5)).toEqual([5])
    expect(niceTicks(7, 3, 5)).toEqual([])
  })
})

describe('placeLineLabels', () => {
  const crossings = (items, placed, left, right) => {
    let n = 0
    items.forEach((it, j) => {
      const x0 = placed[j].anchor === 'start' ? it.x : it.x - it.width
      const x1 = x0 + it.width
      items.forEach((other, m) => {
        if (m !== j && placed[m].row < placed[j].row && other.x >= x0 && other.x <= x1) n += 1
      })
      if (x0 < left || x1 > right) n += 100
    })
    return n
  }
  it('one line near the left: label to the right of the line, top row', () => {
    expect(placeLineLabels([{ x: 40, width: 150 }], 0, 560)).toEqual([{ row: 0, anchor: 'start' }])
  })
  it('one line near the right edge: label to the left of the line', () => {
    expect(placeLineLabels([{ x: 540, width: 150 }], 0, 560)).toEqual([{ row: 0, anchor: 'end' }])
  })
  it('three lines: every label on its own row and no line runs through another label', () => {
    for (const xs of [[40, 300, 520], [200, 215, 230], [300, 305, 540], [20, 25, 30]]) {
      const items = xs.map((x) => ({ x, width: 150 }))
      const placed = placeLineLabels(items, 0, 560)
      expect(new Set(placed.map((p) => p.row)).size).toBe(3)
      expect(crossings(items, placed, 0, 560)).toBe(0)
    }
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

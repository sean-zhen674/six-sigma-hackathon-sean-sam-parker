import { describe, it, expect } from 'vitest'
import { TOUR_STEPS, markTourSeen, tourSeen } from './tour.js'

function fakeStorage() {
  const data = {}
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v } }
}
const broken = {
  getItem() { throw new Error('blocked') },
  setItem() { throw new Error('blocked') },
}

describe('tour flag', () => {
  it('is not seen at first, and seen after it is marked', () => {
    const s = fakeStorage()
    expect(tourSeen(s)).toBe(false)
    markTourSeen(s)
    expect(tourSeen(s)).toBe(true)
  })
  it('does not throw when storage is blocked', () => {
    expect(tourSeen(broken)).toBe(false)
    expect(() => markTourSeen(broken)).not.toThrow()
  })
  it('has 4 steps', () => {
    expect(TOUR_STEPS).toHaveLength(4)
  })
  it('the table step says builds show as NOT RELEASED when the process is not capable', () => {
    expect(TOUR_STEPS[3].text).toContain('If the process is not capable, builds show as NOT RELEASED.')
  })
  it('step 1 names the two controls by their current labels (H-12)', () => {
    expect(TOUR_STEPS[0].text).toBe(
      'Use "Select an example dataset" to pick a built-in example, or "Upload dataset" to analyze your own spreadsheet file (CSV), with one row per coupon and 5 coupons per build.')
    const all = TOUR_STEPS.map((s) => `${s.title} ${s.text}`).join(' ')
    expect(all).not.toMatch(/test dataset|Use my own/i)
  })
})

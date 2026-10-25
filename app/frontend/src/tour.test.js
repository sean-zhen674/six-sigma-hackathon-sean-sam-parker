import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
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
  it('has 6 steps (H-19 added the calculations toggle and the possible causes section)', () => {
    expect(TOUR_STEPS).toHaveLength(6)
    expect(TOUR_STEPS.map((s) => s.title)).toEqual([
      'Pick your data', 'Read the banner', 'See the calculations', 'Find the red diamonds', 'Look for possible causes', 'Act on each build'])
  })
  it('the calculations step explains the steps and the histogram lines, and points at the toggle', () => {
    const s = TOUR_STEPS[2]
    expect(s.target).toBe('calc-toggle')
    expect(s.text).toContain('Show the calculations and histograms')
    expect(s.text).toMatch(/process average/)
    expect(s.text).toMatch(/allowed values/)
  })
  it('the possible causes step explains parallel lines and the p-value, and points at the section', () => {
    const s = TOUR_STEPS[4]
    expect(s.target).toBe('causes')
    expect(s.text).toMatch(/parallel/)
    expect(s.text).toMatch(/p-value/)
    expect(s.text).toMatch(/not (prove|proof)|does not prove/)
  })
  it('every step points at a section of the page', () => {
    expect(TOUR_STEPS.map((s) => s.target)).toEqual(['controls', 'banner-top', 'calc-toggle', 'charts', 'causes', 'builds'])
  })
  it('every target is the id of an element that App renders', () => {
    const files = ['App.jsx', 'Calculations.jsx', 'Causes.jsx']
    const source = files.map((f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).join('\n')
    for (const s of TOUR_STEPS.filter((x) => x.target)) expect(source).toContain(`id="${s.target}"`)
  })
  it('the table step says builds show as NOT RELEASED when the process is not capable', () => {
    expect(TOUR_STEPS[5].text).toContain('If the process is not capable, builds show as NOT RELEASED.')
  })
  it('step 1 names the two controls by their current labels (H-12)', () => {
    expect(TOUR_STEPS[0].text).toBe(
      'Use "Select an example dataset" to pick a built-in example, or "Upload dataset" to analyze your own spreadsheet file (CSV), with one row per coupon and 5 coupons per build.')
    const all = TOUR_STEPS.map((s) => `${s.title} ${s.text}`).join(' ')
    expect(all).not.toMatch(/test dataset|Use my own/i)
  })
})

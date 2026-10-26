import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { README_URL } from './format.js'
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
  it('has 8 steps (H-20 added the purpose step first and the documentation step last)', () => {
    expect(TOUR_STEPS).toHaveLength(8)
    expect(TOUR_STEPS.map((s) => s.title)).toEqual([
      'What AeroPrint is for', 'Pick your data', 'Read the banner', 'See the calculations', 'Find the red diamonds', 'Look for possible causes', 'Act on each build', 'Read the full documentation'])
  })
  it('the calculations step explains the steps and the histogram lines, and points at the toggle', () => {
    const s = TOUR_STEPS[3]
    expect(s.target).toBe('calc-toggle')
    expect(s.text).toContain('Show the calculations and histograms')
    expect(s.text).toMatch(/process average/)
    expect(s.text).toMatch(/allowed values/)
  })
  it('the possible causes step explains parallel lines and the p-value, and points at the section', () => {
    const s = TOUR_STEPS[5]
    expect(s.target).toBe('causes')
    expect(s.text).toMatch(/parallel/)
    expect(s.text).toMatch(/p-value/)
    expect(s.text).toMatch(/not (prove|proof)|does not prove/)
  })
  it('each step has the expected target (steps 1 and 8 have none and open a centred dialog)', () => {
    expect(TOUR_STEPS.map((s) => s.target)).toEqual([null, 'controls', 'banner-top', 'calc-toggle', 'charts', 'causes', 'builds', null])
  })
  it('every target is the id of an element that App renders', () => {
    const files = ['App.jsx', 'Calculations.jsx', 'Causes.jsx']
    const source = files.map((f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).join('\n')
    for (const s of TOUR_STEPS.filter((x) => x.target)) expect(source).toContain(`id="${s.target}"`)
  })
  it('H-21: the page shows the API disposition as it is (no relabelling of RELEASE in App.jsx)', () => {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/!capable && b\.disposition/)
    expect(source).toContain("'NOT RELEASED'")
    expect(source).toContain('TEXT.notReleased')
  })
  it('the table step says builds show as NOT RELEASED when the process is not capable', () => {
    expect(TOUR_STEPS[6].text).toContain('If the process is not capable, builds show as NOT RELEASED.')
  })
  it('the second step (index 1) names the two controls by their current labels (H-12)', () => {
    expect(TOUR_STEPS[1].text).toBe(
      'Use "Select an example dataset" to pick a built-in example, or "Upload dataset" to analyze your own spreadsheet file (CSV), with one row per coupon and 5 coupons per build.')
    const all = TOUR_STEPS.map((s) => `${s.title} ${s.text}`).join(' ')
    expect(all).not.toMatch(/test dataset|Use my own/i)
  })
  it('the first step names the user, the decisions and the example datasets, in a centred dialog', () => {
    const s = TOUR_STEPS[0]
    expect(s.target).toBeNull()
    for (const w of ['supplier quality engineer', 'release', 'quarantine', 'three example datasets', 'upload your own spreadsheet file (CSV)']) expect(s.text).toContain(w)
  })
  it('the last step points at the README and the codebook, with a real link', () => {
    const s = TOUR_STEPS[TOUR_STEPS.length - 1]
    expect(s.target).toBeNull()
    expect(s.text).toMatch(/README/)
    expect(s.text).toMatch(/codebook/)
    expect(s.text).toContain('"GitHub repository"')
    expect(s.link).toEqual({ href: README_URL, label: 'Open the README on GitHub' })
    expect(s.link.href).toBe('https://github.com/sean-zhen674/six-sigma-hackathon-sean-sam-parker#readme')
  })
  it('only the last step has a link', () => {
    expect(TOUR_STEPS.filter((s) => s.link)).toHaveLength(1)
  })
})

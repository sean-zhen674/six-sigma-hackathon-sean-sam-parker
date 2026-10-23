// Pure geometry helpers for the hand-drawn SVG charts. They map numbers to pixel positions.
// No statistics here: the control limits always come from the API.

/** Returns a function mapping a value in [d0, d1] to a pixel in [r0, r1]. */
export function makeScale(d0, d1, r0, r1) {
  return (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0))
}

/** x pixel of point i of n between left and right (one point sits in the middle). */
export function xPosition(i, n, left, right) {
  return n <= 1 ? (left + right) / 2 : left + (i * (right - left)) / (n - 1)
}

/** Min / max of the finite numbers in a list; null when there are none. */
export function extent(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  return nums.length ? [Math.min(...nums), Math.max(...nums)] : null
}

/** Is a spec limit close enough to the data to draw? Within one data-span of either end. */
export function specVisible(value, domain) {
  if (typeof value !== 'number' || !domain) return false
  const span = domain[1] - domain[0]
  return value >= domain[0] - span && value <= domain[1] + span
}

/** y axis range: the points, the limits and any visible spec lines, plus 8 % padding. */
export function chartDomain(values, limits, specValues = []) {
  const base = extent([...values, ...limits])
  if (!base) return [0, 1]
  const visible = specValues.filter((s) => specVisible(s, base))
  const [lo, hi] = extent([...base, ...visible])
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1
  return [lo - pad, hi + pad]
}

/**
 * Move label centers apart so boxes of height h do not overlap, and keep them between lo and hi.
 * items: [{ y, h }] -> new y for each item, in the same order.
 */
export function spreadLabels(items, lo, hi) {
  const order = items.map((_, i) => i).sort((a, b) => items[a].y - items[b].y)
  const ys = items.map((it) => it.y)
  let edge = lo
  for (const i of order) {
    ys[i] = Math.max(ys[i], edge + items[i].h / 2)
    edge = ys[i] + items[i].h / 2
  }
  edge = hi
  for (const i of [...order].reverse()) {
    ys[i] = Math.min(ys[i], edge - items[i].h / 2)
    edge = ys[i] - items[i].h / 2
  }
  return ys
}

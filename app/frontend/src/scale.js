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

/** y axis range: the points and the control limits, plus 8 % padding. */
export function chartDomain(values, limits) {
  const base = extent([...values, ...limits])
  if (!base) return [0, 1]
  const [lo, hi] = base
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

/**
 * Friendly axis tick values inside [lo, hi]: about `count` of them, a step of 1, 2 or 5 times a power
 * of ten. A flat range gives that single value; a reversed range gives none. Used only to place labels.
 */
export function niceTicks(lo, hi, count = 5) {
  if (!(hi >= lo)) return []
  if (hi === lo) return [lo]
  const rough = (hi - lo) / Math.max(count - 1, 1)
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const ticks = []
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9; k += 1) {
    ticks.push(Number((k * step).toFixed(decimals)))
  }
  return ticks
}

/**
 * Where to write the name of each vertical line so no label sits on another label or on another line.
 * items: [{ x, width }] (x = pixel position of the line, width = pixel width of its text).
 * Each label gets its own row (row 0 is the top). Its text starts at the line ('start') or ends at
 * it ('end'). A line runs from its own row down to the axis, so a line crosses a label when it starts
 * ABOVE that label and sits inside the label's text. Every row order and side is tried (at most 3
 * lines, so at most 48 choices) and the one with the fewest problems wins; ties keep the first.
 */
export function placeLineLabels(items, left, right) {
  const n = items.length
  const orders = permutations([...Array(n).keys()])
  let best = null
  for (const order of orders) {
    for (let sides = 0; sides < 2 ** n; sides += 1) {
      const choice = items.map((_, i) => ({ row: order[i], anchor: (sides >> i) & 1 ? 'end' : 'start' }))
      let cost = 0
      items.forEach((it, j) => {
        const x0 = choice[j].anchor === 'start' ? it.x : it.x - it.width
        const x1 = x0 + it.width
        if (x0 < left || x1 > right) cost += 100
        items.forEach((other, m) => {
          if (m !== j && choice[m].row < choice[j].row && other.x >= x0 && other.x <= x1) cost += 1
        })
      })
      if (best === null || cost < best.cost) best = { cost, choice }
    }
  }
  return best ? best.choice : []
}

function permutations(list) {
  if (list.length <= 1) return [list]
  return list.flatMap((item, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest]))
}

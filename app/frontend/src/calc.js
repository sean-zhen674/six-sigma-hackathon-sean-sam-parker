// Words and numbers for the "Show the calculations and histograms" toggle (H-17).
// Nothing is calculated here: every number comes from the API's answer. This file only picks the
// words, rounds numbers for display (fmt) and joins them into sentences.
import { fmt, plainNote } from './format.js'
import { TEXT } from './labels.js'

/** A number for a sum: a negative number gets brackets and a real minus sign, so "a − (−b)" reads clearly. */
function num(value, digits) {
  const text = fmt(value, digits)
  return text.startsWith('-') ? `(−${text.slice(1)})` : text
}

/** A number on its own (no brackets). */
function plain(value, digits) {
  return fmt(value, digits).replace(/^-/, '−')
}

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * The calculation for one measurement, in steps, from the API's numbers.
 *   q       one entry of QUALITY (key, unit, digits)
 *   result  the whole /analyze answer
 * Returns { steps: [{ title, words, math }], verdict, message }.
 *   verdict  the sentence about the minimum index, or null when there is no index
 *   message  the API's note (in words) when the index is not defined, else null
 * The mean, average range and standard deviation show one more decimal than the measurement, so the
 * sums can be followed by hand; the allowed values show the measurement's own decimals.
 */
export function calcBlock(q, result) {
  const cap = result.capability[q.key]
  const rbar = result.charts[q.key].r.cl
  const d2 = result.settings.constants.d2
  const size = result.settings.subgroup_size
  const threshold = result.settings.capable_min_index
  const more = q.digits + 1
  const unit = q.unit ? ` ${q.unit}` : ''
  const times = (k) => `${k} × ${fmt(cap.sigma_hat, more)}` // 3 sigma-hat for one limit, 6 sigma-hat for the width
  const T = TEXT.calc
  const steps = [
    { ...T.mean, math: `${plain(cap.mean, more)}${unit}` },
    { ...T.rbar, math: `${plain(rbar, more)}${unit}` },
    {
      title: T.sigma.title,
      words: T.sigma.words.replace('{d2}', fmt(d2, 3)).replace('{size}', String(size)),
      math: `${fmt(rbar, more)} / ${fmt(d2, 3)} = ${plain(cap.sigma_hat, more)}${unit}`,
    },
  ]
  const hasLower = isNumber(cap.cpl)
  const hasUpper = isNumber(cap.cpu)
  if (hasLower) {
    steps.push({ ...T.cpl, math: `(${num(cap.mean, more)} − ${num(cap.lsl, q.digits)}) / (${times(3)}) = ${plain(cap.cpl, 2)}` })
  }
  if (hasUpper) {
    steps.push({ ...T.cpu, math: `(${num(cap.usl, q.digits)} − ${num(cap.mean, more)}) / (${times(3)}) = ${plain(cap.cpu, 2)}` })
  }
  if (hasLower && hasUpper && isNumber(cap.cp)) {
    steps.push({ ...T.cp, math: `(${num(cap.usl, q.digits)} − ${num(cap.lsl, q.digits)}) / (${times(6)}) = ${plain(cap.cp, 2)}` })
  }
  if (isNumber(cap.cpk)) {
    steps.push(hasLower && hasUpper
      ? { ...T.cpkTwo, math: `smaller of (${plain(cap.cpl, 2)}, ${plain(cap.cpu, 2)}) = ${plain(cap.cpk, 2)}` }
      : { ...T.cpkOne, math: plain(cap.cpk, 2) })
  }

  let verdict = null
  let message = null
  if (!isNumber(cap.cpk)) {
    message = cap.message ? plainNote(cap.message) : null
  } else if (cap.reliable === false) {
    verdict = `The index is ${plain(cap.cpk, 2)} and the minimum is ${fmt(threshold, 2)}. The chart is out of control, so this index does not count.`
  } else if (cap.capable) {
    verdict = `${plain(cap.cpk, 2)} is at least the minimum of ${fmt(threshold, 2)}: Meets the minimum`
  } else {
    verdict = `${plain(cap.cpk, 2)} is below the minimum of ${fmt(threshold, 2)}: Not capable`
  }
  return { steps, verdict, message }
}

/** The histogram's bins as [{ from, to, count }]; none when the API sent no histogram. */
export function histogramBins(hist) {
  if (!hist || !Array.isArray(hist.counts)) return []
  return hist.counts.map((count, i) => ({ from: hist.edges[i], to: hist.edges[i + 1], count }))
}

/** The screen reader summary of one histogram. */
export function histogramSummary(q, cap) {
  const h = cap.histogram
  const unit = q.unit ? ` ${q.unit}` : ''
  const parts = [`process average ${fmt(cap.mean, q.digits)}${unit}`]
  if (isNumber(cap.lsl)) parts.push(`lowest allowed ${fmt(cap.lsl, q.digits)}${unit}`)
  if (isNumber(cap.usl)) parts.push(`highest allowed ${fmt(cap.usl, q.digits)}${unit}`)
  const head = h
    ? `Histogram of ${h.n} coupons from ${h.n_builds} baseline builds, from ${fmt(h.edges[0], q.digits)} to ${fmt(h.edges[h.edges.length - 1], q.digits)}${unit}.`
    : 'No histogram is available.'
  return `${head} ${parts.join(', ').replace(/^p/, 'P')}.`
}

/** The heading of one block: Title Case with the unit, for example 'Tensile Strength (MPa)'. */
export function blockHeading(q) {
  const title = q.title.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return q.unit ? `${title} (${q.unit})` : title
}

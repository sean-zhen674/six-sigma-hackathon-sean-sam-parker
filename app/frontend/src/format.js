// Pure display helpers. They format and reshape numbers that the API already computed.
// Nothing in this file calculates a statistic.

/** Number -> fixed decimals; null / undefined / NaN -> 'n/a'. */
export function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a'
  return Number(value).toFixed(digits)
}

/** '2026-02-18T08:00:00' -> '2026-02-18 08:00'. */
export function fmtTime(ts) {
  return ts ? String(ts).replace('T', ' ').slice(0, 16) : 'n/a'
}

/** 'B-1023' -> '1023' (short axis label). */
export function shortBuild(id) {
  return String(id).replace(/^B-/, '')
}

/** Turn an API error response into one readable sentence. 422 detail may be text or a list. */
export function errorText(status, body) {
  const detail = body && body.detail
  let text
  if (typeof detail === 'string') text = detail
  else if (Array.isArray(detail)) text = detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
  else text = 'the API gave no details'
  return `HTTP ${status}: ${text}`
}

/** The API's top suspect for a build ({parameter, z, rules}) or null. */
export function topSuspect(build) {
  const first = build && build.investigate_first && build.investigate_first[0]
  return first ? { parameter: first.parameter, z: first.z, rules: first.rules } : null
}

export function suspectText(build) {
  const s = topSuspect(build)
  return s ? `${s.parameter} (z = ${fmt(s.z, 1)})` : '-'
}

/** API flags {"1": [indices], ... "8": [...]} -> one array of rule numbers per point. */
export function perPointRules(flags, n) {
  const out = Array.from({ length: n }, () => [])
  for (const [rule, indices] of Object.entries(flags || {})) {
    for (const i of indices) if (out[i]) out[i].push(Number(rule))
  }
  return out
}

/** A plain list of flagged indices (R and MR charts: rule 1 only) -> per-point rule arrays. */
export function listToPerPoint(indices, n) {
  return perPointRules({ 1: indices || [] }, n)
}

/** X-bar chart object from the API -> props for <ControlChart>. */
export function xbarProps(chart, specs) {
  const x = chart.xbar
  return {
    values: x.points, cl: x.cl, ucl: x.ucl, lcl: x.lcl,
    rules: perPointRules(x.flags, x.points.length),
    specs,
  }
}

export function rProps(chart) {
  const r = chart.r
  return {
    values: r.points, cl: r.cl, ucl: r.ucl, lcl: r.lcl,
    rules: listToPerPoint(r.flags, r.points.length),
    specs: [],
  }
}

/** I chart object (one parameter) from the API -> props. */
export function iProps(p) {
  return {
    values: p.points, cl: p.cl, ucl: p.ucl, lcl: p.lcl,
    rules: perPointRules(p.flags, p.points.length), specs: [],
  }
}

/** MR chart: the API gives n-1 moving ranges; the first build has none, so pad with null. */
export function mrProps(p) {
  const values = [null, ...p.moving_ranges]
  return {
    values, cl: p.mr_bar, ucl: p.mr_ucl, lcl: 0,
    rules: listToPerPoint(p.mr_flags, values.length), specs: [],
  }
}

/** One banner row: the index text and whether the API calls it reliable. */
export function capabilityRow(cap, indexKey) {
  const value = cap[indexKey]
  return {
    value,
    text: fmt(value, 2),
    reliableLabel: cap.reliable ? 'reliable' : 'not reliable (chart out of control)',
    message: value === null || value === undefined ? cap.message : null,
    capable: cap.capable,
  }
}

// Pure display helpers. They format and reshape numbers that the API already computed.
// Nothing in this file calculates a statistic.
import { plainNote } from './plain.js'
import { QUALITY } from './labels.js'

// The plain-words helpers (H-11) live in plain.js and are re-exported here.
export * from './plain.js'

/** Number -> fixed decimals; null / undefined / NaN -> 'not available'. */
export function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'not available'
  return Number(value).toFixed(digits)
}

/** '2026-02-18T08:00:00' -> '2026-02-18 08:00'. */
export function fmtTime(ts) {
  return ts ? String(ts).replace('T', ' ').slice(0, 16) : 'not available'
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
  else text = 'the analysis service gave no details'
  return `HTTP ${status}: ${text}`
}

/** The API's top suspect for a build ({parameter, z, rules}) or null. */
export function topSuspect(build) {
  const first = build && build.investigate_first && build.investigate_first[0]
  return first ? { parameter: first.parameter, z: first.z, rules: first.rules } : null
}

/**
 * The "investigate first" cell. z is how many standard deviations the build's parameter sits from
 * its center line (the API's number); the sign only picks the word above or below.
 */
export function suspectText(build) {
  const s = topSuspect(build)
  if (!s) return '-'
  const side = Number(s.z) < 0 ? 'below' : 'above'
  return `${friendlyParam(s.parameter)}: ${fmt(Math.abs(Number(s.z)), 1)} standard deviations ${side} the center line`
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
export function xbarProps(chart) {
  const x = chart.xbar
  return {
    values: x.points, cl: x.cl, ucl: x.ucl, lcl: x.lcl,
    rules: perPointRules(x.flags, x.points.length),
  }
}

export function rProps(chart) {
  const r = chart.r
  return {
    values: r.points, cl: r.cl, ucl: r.ucl, lcl: r.lcl,
    rules: listToPerPoint(r.flags, r.points.length),
  }
}

/** I chart object (one parameter) from the API -> props. */
export function iProps(p) {
  return {
    values: p.points, cl: p.cl, ucl: p.ucl, lcl: p.lcl,
    rules: perPointRules(p.flags, p.points.length),
  }
}

/** MR chart: the API gives n-1 moving ranges; the first build has none, so pad with null. */
export function mrProps(p) {
  const values = [null, ...p.moving_ranges]
  return {
    values, cl: p.mr_bar, ucl: p.mr_ucl, lcl: 0,
    rules: listToPerPoint(p.mr_flags, values.length),
  }
}

/**
 * One banner row: the index text and the small line under it. Only words are chosen here; the API
 * already decided reliable (chart in control) and capable (index at least the minimum).
 *   chart out of control   -> no small line (the warning line says it)
 *   in control, capable    -> 'Meets the minimum of 1.33'
 *   in control, not capable-> 'Below the minimum of 1.33: Not capable'
 * No index at all keeps the API's message.
 */
export function capabilityRow(cap, indexKey, threshold = 1.33) {
  const value = cap[indexKey]
  const missing = value === null || value === undefined
  const unreliable = isUnreliable(cap, indexKey)
  const minimum = fmt(threshold, 2)
  let status = 'none'
  let statusText = null
  if (!missing && !unreliable) {
    status = cap.capable ? 'meets' : 'below'
    statusText = cap.capable ? `Meets the minimum of ${minimum}` : `Below the minimum of ${minimum}: Not capable`
  } else if (unreliable) {
    status = 'unreliable'
  }
  return {
    value,
    text: fmt(value, 2),
    status,
    statusText,
    message: missing ? plainNote(cap.message) : null,
    capable: cap.capable,
    unreliable,
  }
}

// ---- H-09: plain-English wording and spec-limit input checks ----
// Still no statistics: these only join words and numbers the API already returned.

/** Friendly names for build parameters (the API sends the column name). */
export const PARAM_NAMES = {
  chamber_oxygen_ppm: 'chamber oxygen (ppm)',
  laser_power_W: 'laser power (W)',
  scan_speed_mm_s: 'scan speed (mm/s)',
  layer_thickness_um: 'layer thickness (µm)',
  humidity_pct: 'humidity (%)',
  powder_bed_temp_C: 'powder bed temperature (°C)',
  build_plate_temp_C: 'build plate temperature (°C)',
  stress_relief_temp_C: 'stress relief temperature (°C)',
}

export function friendlyParam(name) {
  return PARAM_NAMES[name] || String(name)
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** Names of the measures whose index the API calls reliable but not capable (display only). */
function belowMinimum(result) {
  const cap = result.capability
  if (!cap || !result.settings || result.settings.capable_min_index == null) return []
  return QUALITY
    .filter((q) => cap[q.key] && cap[q.key].reliable === true && cap[q.key].capable === false
      && cap[q.key][q.index] !== null && cap[q.key][q.index] !== undefined)
    .map((q) => q.title)
}

/**
 * One or two sentences that sum up an API result. It only reads API fields:
 * process_capable, first_out_of_control_build, builds[].disposition,
 * builds[].investigate_first[0].parameter. Counting dispositions counts the API's labels.
 */
export function summarySentence(result) {
  const builds = result.builds || []
  const total = builds.length
  const quarantined = builds.filter((b) => b.disposition === 'QUARANTINE').length
  const first = result.first_out_of_control_build

  if (first) {
    let head = `From build ${first} the process went out of control`
    if (quarantined > 0) {
      head += `; ${plural(quarantined, 'build', 'builds')} should be quarantined`
    }
    head += '.'
    const flagged = builds.find((b) => b.build_id === first) || builds.find((b) => b.disposition === 'QUARANTINE')
    const suspect = topSuspect(flagged)
    const cause = suspect
      ? `Most likely cause: ${capital(friendlyParam(suspect.parameter))}.`
      : 'No build parameter stands out as the cause.'
    return `${head} ${cause}`
  }
  if (result.process_capable) {
    return `All ${total} builds are in control and capable. Every build can be released.`
  }
  // In control, but not capable (an index is below the minimum, or an index is missing).
  const below = belowMinimum(result)
  return below.length > 0
    ? `No build broke a rule, but ${below.join(' and ')} ${below.length === 1 ? 'is' : 'are'} below the minimum of ${fmt(result.settings.capable_min_index, 2)}, so the process is not shown to be capable.`
    : 'No build broke a rule, but the process is not shown to be capable of the specification.'
}

/**
 * 'oxygen_drift' -> 'Oxygen Drift'. Display text only: the dropdown value stays the API name.
 * Underscores become single spaces, every word starts with a capital, other letters are left alone,
 * and null / undefined / '' give ''.
 */
export function datasetLabel(name) {
  return String(name ?? '')
    .split('_')
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Heading shown above the two dimensional deviation boxes (they sit side by side). */
export const DIM_GROUP = 'Dimensional Deviation'

/**
 * The four spec boxes, in the order they are shown (this is also the order sent to the API).
 * H-12: the units are abbreviated in these labels at the team's request: (MPa), (%), (mm).
 * `group` + `short`: the two dimensional boxes show `short` under the DIM_GROUP heading; their full
 * `label` is still their accessible name.
 */
export const SPEC_FIELDS = [
  { name: 'uts_lsl', label: 'Tensile Strength: Lowest Allowed (MPa)', from: ['uts_MPa', 'lsl'] },
  { name: 'porosity_usl', label: 'Porosity: Highest Allowed (%)', from: ['porosity_pct', 'usl'] },
  { name: 'dim_lsl', label: `${DIM_GROUP}: Lowest Allowed (mm)`, short: 'Lowest Allowed (mm)', group: DIM_GROUP, from: ['dimensional_dev_mm', 'lsl'] },
  { name: 'dim_usl', label: `${DIM_GROUP}: Highest Allowed (mm)`, short: 'Highest Allowed (mm)', group: DIM_GROUP, from: ['dimensional_dev_mm', 'usl'] },
]

const specLabel = (name) => SPEC_FIELDS.find((f) => f.name === name).label

/** The /spec-limits answer -> the text shown in the four boxes. */
export function specDefaults(limits) {
  const out = {}
  for (const f of SPEC_FIELDS) out[f.name] = String(limits.specs[f.from[0]][f.from[1]] ?? '')
  return out
}

/**
 * Check the four boxes before sending anything. A blank box means "use the default".
 * Returns { ok: true } or { ok: false, message }.
 */
export function validateSpecs(raw) {
  const nums = {}
  for (const f of SPEC_FIELDS) {
    const text = String(raw[f.name] ?? '').trim()
    if (text === '') continue
    const n = Number(text)
    if (!Number.isFinite(n)) return { ok: false, message: `${f.label} must be a number (got "${text}").` }
    nums[f.name] = n
  }
  if (nums.dim_lsl !== undefined && nums.dim_usl !== undefined && nums.dim_lsl >= nums.dim_usl) {
    return { ok: false, message: `${specLabel('dim_lsl')} must be below ${specLabel('dim_usl')}.` }
  }
  return { ok: true }
}

/** Query string for GET /analyze/{dataset} and POST /analyze: baseline_n plus the non-blank spec boxes. */
export function analysisQuery(baselineN, specs) {
  const q = new URLSearchParams({ baseline_n: String(baselineN) })
  for (const [key, value] of Object.entries(specs || {})) {
    if (value !== '' && value !== null && value !== undefined) q.set(key, String(value).trim())
  }
  return q.toString()
}

/** Baseline builds: the starting value and the smallest the analysis service accepts. */
export const DEFAULT_BASELINE = 20
/** Fewer baseline builds than this show the rough-limits caution. */
export const BASELINE_CAUTION_BELOW = 10
export const BASELINE_MIN = 3

/** Show the rough-limits caution? `baselineNUsed` is result.settings.baseline_n_used: the number the API really used (never more than the file's builds), the same number its warning is based on. */
export function showBaselineCaution(baselineNUsed) {
  return typeof baselineNUsed === 'number' && baselineNUsed < BASELINE_CAUTION_BELOW
}

/** Below this window width (in pixels) the charts get too small to read comfortably. */
export const NARROW_SCREEN_PX = 500
export function isNarrowScreen(width) {
  return Number.isFinite(width) && width > 0 && width < NARROW_SCREEN_PX
}

/**
 * What to do with the Baseline builds box (Enter, leaving the box and the Update charts button all ask this).
 * `raw` is what is in the box now; `applied` is the value of the last run.
 * Returns { kind: 'apply', value } | { kind: 'unchanged' } | { kind: 'invalid', message }.
 */
export function baselineChange(raw, applied) {
  const text = raw === null || raw === undefined ? '' : String(raw).trim()
  const n = text === '' ? NaN : Number(text)
  if (!Number.isInteger(n) || n < BASELINE_MIN) {
    return { kind: 'invalid', message: `Baseline builds must be a whole number of at least ${BASELINE_MIN}.` }
  }
  if (n === Number(applied)) return { kind: 'unchanged' }
  return { kind: 'apply', value: n }
}

/** One line of help under each chart title. The same component shows all of them. */
export const CHART_HELP = {
  xbar: "The average of each build's 5 coupons.",
  r: 'How spread out the 5 coupons are inside one build.',
  i: 'One value per build.',
  mr: 'How much the value changed from one build to the next.',
}

/** True when the API gave a number for this index but marked it not reliable. */
export function isUnreliable(cap, indexKey) {
  const value = cap[indexKey]
  return value !== null && value !== undefined && cap.reliable === false
}

export const UNRELIABLE_TEXT = 'Chart out of control'

// ---- H-10: friendlier upload errors and the CSV format panel ----
// Still no statistics: these map the API's 422 texts to plain advice.

/** The project's public repository (linked from the header). */
export const REPO_URL = 'https://github.com/sean-zhen674/six-sigma-hackathon-sean-sam-parker'

/** H-20: where the full documentation and the dataset codebook live on GitHub. */
export const README_URL = REPO_URL + '#readme'
export const CODEBOOK_URL = REPO_URL + '/blob/main/data/README.md'

export const REQUIRED_COLUMNS = ['build_id', 'build_timestamp', 'uts_MPa', 'porosity_pct', 'dimensional_dev_mm']
export const OPTIONAL_COLUMNS = [
  'laser_power_W', 'scan_speed_mm_s', 'layer_thickness_um', 'chamber_oxygen_ppm',
  'humidity_pct', 'powder_bed_temp_C', 'build_plate_temp_C', 'stress_relief_temp_C',
]
/** H-21: two optional text columns, one value per build, used by the Possible Causes section. */
export const FACTOR_COLUMNS = ['machine_id', 'material_lot']

/**
 * Turn the API's 422 text (or the "HTTP 422: ..." sentence built from it) into a plain-English
 * hint that says what is wrong and how to fix it. Returns null for a message we do not know,
 * so the page then shows the raw text only.
 */
export function explainUploadError(detail) {
  const text = String(detail || '')
  let m = text.match(/missing required columns?: ([^\n]+)/)
  if (m) {
    return `Your file is missing a required column: ${m[1].trim()}. Add it, or rename the column you already have. `
      + 'The header must match exactly, including capital letters and underscores.'
  }
  m = text.match(/build (\S+) has (\d+) coupons?[^;]*; each build needs exactly 5/)
  if (m) {
    return `Build ${m[1]} has ${m[2]} coupon row${m[2] === '1' ? '' : 's'}, but every build needs exactly 5 (one row per coupon). `
      + 'Add the missing rows, remove the extra rows, or take that build out of the file.'
  }
  m = text.match(/column '([^']+)' has non-numeric text, for example '([^']*)'/)
  if (m) {
    return `Column ${m[1]} contains text ("${m[2]}") where a number is needed. `
      + 'Type plain numbers only: No units or symbols such as the percent sign, a decimal point (not a comma), and no words.'
  }
  m = text.match(/column '([^']+)' has an infinite value/)
  if (m) {
    return `Column ${m[1]} contains an endless value (inf, or a number too large to store). `
      + 'Replace it with the real measurement, or delete that row.'
  }
  m = text.match(/column '([^']+)' contains True\/False values/)
  if (m) {
    return `Column ${m[1]} holds True/False instead of measurements. Export the measured numbers instead.`
  }
  m = text.match(/column '([^']+)' contains dates or times/)
  if (m) {
    return `Column ${m[1]} holds dates, but a measurement column should hold plain numbers. `
      + 'Check that the columns are not shifted or in the wrong order.'
  }
  m = text.match(/column '([^']+)' appears (\d+) times in the header/)
  if (m) {
    return `Two columns share the name ${m[1]}. Delete one of them, or rename it.`
  }
  if (/the file has a header but no data rows/.test(text)) {
    return 'The file has column names but no builds. Add one row per coupon, with five rows for each build.'
  }
  m = text.match(/column '([^']+)' has (\d+) blank or missing values?/)
  if (m) {
    return `Column ${m[1]} has ${m[2]} empty cell${m[2] === '1' ? '' : 's'}. `
      + 'Fill every cell in that column, or delete the rows that are incomplete.'
  }
  if (/build_timestamp is not a valid date/.test(text)) {
    return 'Some build_timestamp values are not dates the tool can read. '
      + 'Use the form 2026-01-05T08:00:00 (year-month-day, then T, then hours:minutes:seconds).'
  }
  if (/could not read the upload as a CSV/.test(text)) {
    return 'The file could not be read as a spreadsheet file (CSV). Save it as a comma-separated UTF-8 file with a header row '
      + '(in Excel: Save As, then choose the UTF-8 comma-separated type) and try again.'
  }
  if (/need at least 2 builds/.test(text)) {
    return 'A control chart needs at least 2 builds (20 or more is best). Add more builds to the file.'
  }
  return null
}

/**
 * Which rules were broken on one chart, and on which builds: [{ rule, builds }] sorted by rule number.
 * `rules` is the per-point list of rule numbers (as the API sends them); `buildIds` names the points.
 */
export function rulesBroken(rules, buildIds) {
  const byRule = new Map()
  rules.forEach((list, i) => {
    ;(list || []).forEach((r) => {
      if (!byRule.has(r)) byRule.set(r, [])
      byRule.get(r).push(buildIds[i])
    })
  })
  return [...byRule.entries()].sort((a, b) => a[0] - b[0]).map(([rule, builds]) => ({ rule, builds }))
}

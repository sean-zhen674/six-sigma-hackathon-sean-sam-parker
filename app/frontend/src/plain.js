// H-11: plain words. These only translate text the API already sent into words a reader outside
// the course can follow. Nothing here calculates a statistic. Unknown text comes back unchanged.

/** What each column name means, spelled out (shown in the spreadsheet-format panel). */
export const COLUMN_MEANINGS = {
  build_id: 'The build name, such as B-1001',
  build_timestamp: 'When the build was made',
  uts_MPa: 'Tensile strength of the coupon, in MPa',
  porosity_pct: 'Porosity of the coupon, in %',
  dimensional_dev_mm: 'Dimensional deviation of the coupon, in mm',
  laser_power_W: 'Laser power, in W',
  scan_speed_mm_s: 'Scan speed, in mm/s',
  layer_thickness_um: 'Layer thickness, in µm',
  chamber_oxygen_ppm: 'Chamber oxygen, in ppm',
  humidity_pct: 'Humidity, in %',
  powder_bed_temp_C: 'Powder bed temperature, in °C',
  build_plate_temp_C: 'Build plate temperature, in °C',
  stress_relief_temp_C: 'Stress relief temperature, in °C',
}

/** Dataset descriptions in plain words, keyed by dataset name; other names use the API's text. */
export const DATASET_TEXT = {
  capable_baseline: 'Capable Baseline: A healthy process in control. Every capability index at least 1.33, so every build can be released.',
  oxygen_drift: 'Oxygen Drift: Chamber oxygen creeps up from build 21. Look for tensile strength falling and porosity rising.',
  marginal_spread: 'Marginal Spread: In-control on every build, but the parts vary too much in size, so the dimensional deviation capability index is below 1.33 and the process is not capable.',
}

export function datasetText(name, apiText) {
  return DATASET_TEXT[name] || apiText || ''
}

/** The eight Nelson rules in words (used in the table, the tooltips and the notes). */
export const RULE_PHRASES = {
  1: 'one build beyond the control limits',
  2: 'nine builds in a row on the same side of the center line',
  3: 'six builds in a row steadily rising or falling',
  4: 'fourteen builds in a row alternating up and down',
  5: 'two of three builds far from the center line, same side',
  6: 'four of five builds fairly far from the center line, same side',
  7: 'fifteen builds in a row very close to the center line',
  8: 'eight builds in a row far from the center line, on either side',
}
const R_CHART_RULE_1 = 'one build above the upper control limit'

/** Rule number + chart kind -> the rule in words, starting with a capital letter and without the rule number. */
export function rulePhrase(rule, kind) {
  const phrase = (kind === 'r' || kind === 'mr') && Number(rule) === 1 ? R_CHART_RULE_1 : RULE_PHRASES[rule]
  return phrase ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : `Rule ${rule}`
}

/** Rule number + chart kind ('xbar' | 'r' | 'i' | 'mr') -> words, ending with the rule number. */
export function ruleTip(rule, kind) {
  const phrase = (kind === 'r' || kind === 'mr') && Number(rule) === 1 ? R_CHART_RULE_1 : RULE_PHRASES[rule]
  return phrase ? `${phrase} (Nelson rule ${rule})` : `rule ${rule}`
}

const SUBJECTS = { uts: 'Tensile strength', porosity: 'Porosity', dimensional: 'Dimensional deviation' }
const CHART_WORDS = { 'X-bar': 'build average chart', R: 'spread chart' }

/**
 * The API's rule text ('uts X-bar rule 5', 'porosity R rule 1') -> one sentence in words.
 * Anything it does not recognize is returned unchanged.
 */
export function explainRule(text) {
  const raw = text === undefined || text === null ? '' : String(text)
  const m = /^(\S+) (X-bar|R) rule (\d)$/.exec(raw.trim())
  if (!m || !SUBJECTS[m[1]]) return raw
  const tip = ruleTip(Number(m[3]), m[2] === 'R' ? 'r' : 'xbar')
  if (tip.startsWith('rule ')) return raw
  return `${SUBJECTS[m[1]]} ${CHART_WORDS[m[2]]}: ${tip.charAt(0).toUpperCase()}${tip.slice(1)}`
}

const KIND_WORDS = {
  xbar: 'build average chart (X-bar)',
  r: 'spread chart (R, the range)',
  i: 'single value chart (I)',
  mr: 'moving range chart (MR)',
}

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** Chart title, for example 'Tensile strength: Build average chart (X-bar), MPa'. */
export function chartTitle(kind, subject, unit) {
  return `${subject}: ${capital(KIND_WORDS[kind])}${unit ? `, ${unit}` : ''}`
}

const COLUMN_TITLES = {
  uts_MPa: 'Tensile strength',
  porosity_pct: 'Porosity',
  dimensional_dev_mm: 'Dimensional deviation',
  chamber_oxygen_ppm: 'Chamber oxygen',
  laser_power_W: 'Laser power',
  scan_speed_mm_s: 'Scan speed',
  layer_thickness_um: 'Layer thickness',
  humidity_pct: 'Humidity',
  powder_bed_temp_C: 'Powder bed temperature',
  build_plate_temp_C: 'Build plate temperature',
  stress_relief_temp_C: 'Stress relief temperature',
}

/** Notes that start with a column name: 'uts_MPa: <body>'. Returns words, or null if unknown. */
function columnNote(title, body) {
  let n = /^baseline coupons look non-normal \(Shapiro-Wilk p = ([^)]+)\); indices are approximate$/.exec(body)
  if (n) {
    return `${title}: The baseline coupons do not look normally distributed (Shapiro-Wilk test, p-value ${n[1]}), so the capability indices are approximate.`
  }
  if (body === 'porosity is bounded at 0 and skewed, so Cpu is approximate') {
    return `${title}: Porosity cannot go below 0 and its values are skewed, so its capability index for the upper limit is approximate.`
  }
  n = /^only (\d+) builds \(fewer than baseline_n=(\d+)\): limits use all \d+ builds$/.exec(body)
  if (n) return `${title}: The file has only ${n[1]} builds, fewer than the baseline of ${n[2]}, so the limits use all ${n[1]} builds.`
  n = /^limits use the first (\d+) builds \(baseline\)$/.exec(body)
  if (n) return `${title}: The limits use the first ${n[1]} builds (the baseline builds).`
  if (/^zero baseline sigma/.test(body)) return `${title}: This parameter did not vary in the baseline builds, so it is skipped.`
  if (/^baseline has no variation/.test(body)) {
    return `${title}: The baseline builds have no variation, so the limits and the rules cannot be judged.`
  }
  const inner = plainNote(body)
  return inner !== body ? `${title}: ${inner}` : null
}

/** The API's notes and warnings -> plain words. A note it does not know is returned unchanged. */
export function plainNote(text) {
  const raw = text === undefined || text === null ? '' : String(text)
  let m = /^Print-parameter columns not found \(skipped\): (.*)\.$/.exec(raw)
  if (m) return `These optional print-parameter columns were not found and were skipped: ${m[1]}.`
  m = /^few baseline builds \((\d+)\): the control limits are rough, so the rules can raise false alarms; use at least (\d+) builds when you can \(20 or more is best\)$/.exec(raw)
  if (m) return `Few baseline builds (${m[1]}): The control limits are rough, so the rules can raise false alarms. Use at least ${m[2]} builds when you can (20 or more is best).`
  if (/^No print-parameter columns found/.test(raw)) return 'No print-parameter columns were found, so the likely cause is not ranked.'
  if (raw === 'a chart is out of control: capability indices are printed but not reliable') {
    return 'A chart is out of control, so the capability indices are shown but are not reliable.'
  }
  if (raw === 'chart is out of control: indices are printed but not reliable') {
    return 'The chart is out of control, so the capability indices are shown but are not reliable.'
  }
  m = /^zero within-build variation(?:: (.*))?$/.exec(raw)
  if (m) {
    return m[1] && /no run rule/.test(m[1])
      ? 'There is no variation inside the builds, so the limits and the rules cannot be judged.'
      : 'There is no variation inside the builds, so the capability indices are undefined.'
  }
  m = /^(\w+): (.*)$/.exec(raw)
  if (m && COLUMN_TITLES[m[1]]) return columnNote(COLUMN_TITLES[m[1]], m[2]) ?? raw
  return raw
}

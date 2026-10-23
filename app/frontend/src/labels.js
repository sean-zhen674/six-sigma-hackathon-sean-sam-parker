// Visible words for the page, kept in one place so they can be read (and checked) together.
// Rule (H-11): plain words first; the standard short form appears once in parentheses on first
// mention; after that the plain words are used. Nothing here is a statistic.

/** The three quality characteristics. `title` + `unit` build the chart titles. */
export const QUALITY = [
  {
    key: 'uts_MPa', title: 'Tensile strength', unit: 'megapascals', digits: 1, index: 'cpl',
    indexName: 'Tensile strength: Capability index for the lower limit (Cpl)',
  },
  {
    key: 'porosity_pct', title: 'Porosity', unit: 'percent', digits: 3, index: 'cpu',
    indexName: 'Porosity: Capability index for the upper limit (Cpu)',
  },
  {
    key: 'dimensional_dev_mm', title: 'Dimensional deviation', unit: 'millimeters', digits: 3, index: 'cpk',
    indexName: 'Dimensional deviation: Capability index for the nearest limit (Cpk)',
  },
]

/** The optional print parameters (single value charts). */
export const PARAMS = {
  chamber_oxygen_ppm: { title: 'Chamber oxygen', unit: 'parts per million', digits: 1 },
  laser_power_W: { title: 'Laser power', unit: 'watts', digits: 1 },
  scan_speed_mm_s: { title: 'Scan speed', unit: 'millimeters per second', digits: 1 },
  layer_thickness_um: { title: 'Layer thickness', unit: 'micrometers', digits: 2 },
  humidity_pct: { title: 'Humidity', unit: 'percent', digits: 1 },
  powder_bed_temp_C: { title: 'Powder bed temperature', unit: 'degrees Celsius', digits: 1 },
  build_plate_temp_C: { title: 'Build plate temperature', unit: 'degrees Celsius', digits: 1 },
  stress_relief_temp_C: { title: 'Stress relief temperature', unit: 'degrees Celsius', digits: 1 },
}
export const MAIN_PARAMS = ['chamber_oxygen_ppm', 'laser_power_W']

/** "What the rules mean": the eight Nelson rules, in full words. */
export const LEGEND_RULES = [
  [1, 'One point beyond 3 standard deviations (sigma) from the center line (a sudden jump).'],
  [2, 'Nine in a row on the same side of the center line (a small steady shift).'],
  [3, 'Six in a row steadily rising or falling (a drift).'],
  [4, 'Fourteen in a row alternating up and down (two things taking turns).'],
  [5, 'Two of three in a row beyond 2 standard deviations from the center line, on the same side.'],
  [6, 'Four of five in a row beyond 1 standard deviation from the center line, on the same side.'],
  [7, 'Fifteen in a row within 1 standard deviation of the center line (suspiciously flat).'],
  [8, 'Eight in a row beyond 1 standard deviation from the center line, on either side (none near the center).'],
]

/** Other visible sentences used by App.jsx. */
export const TEXT = {
  githubLabel: 'GitHub repository',
  datasetHeading: 'Dataset',
  parametersHeading: 'Parameters',
  datasetLabel: 'Select an example dataset',
  resetHint: 'Puts the four allowed values back and sets Baseline builds back to 20.', // shown as a tooltip on the button (the Parameters box has no grey text)
  fileLabel: 'Upload dataset',
  baselineLabel: 'Baseline builds',
  baselineHelp: 'How many of the earliest builds are used to learn what normal looks like. The control limits are calculated from these builds, and every later build is compared against them. Default: 20, minimum: 5.',
  howToRead: 'A red point means that build behaved differently from the baseline builds; an index of {threshold} or more means the process meets the specification with margin, and it only counts while the chart is in control.',
  chartsIntro: 'Blue shading = baseline builds used for the limits. Red diamond = a rule was broken (hover for the build and rules). The three lines on each chart are the center line, the upper control limit and the lower control limit; each chart lists their values below it.',
  paramsHeading: 'Build parameters (single value and change-from-previous-build charts)',
  noParams: 'No print-parameter columns in this file, so there are no parameter charts and the likely cause is not ranked. Add columns such as chamber_oxygen_ppm or laser_power_W to get them (see the "How should my file be formatted?" button under Upload dataset).',
  noParamsShort: 'No print-parameter columns in this file, so the likely cause is not ranked.',
  dimensionalSummary: 'Dimensional deviation: Build average and spread charts',
  otherParamsSummary: 'Other build parameters (single value charts)',
  flaggedToggle: 'Show only flagged builds (RETEST or QUARANTINE)',
  couponOut: 'a coupon is outside the specification',
  legendIntro: 'Each rule looks for a pattern that is unlikely when the process only has its usual random variation (these are the eight Nelson rules). The build average and single value charts use all eight rules; the spread and change-from-previous-build charts use rule 1 only.',
  quarantine: 'the build broke a rule on the tensile strength or porosity build average or spread chart.',
  retest: 'the charts are in control for this build, but at least one coupon is outside the specification.',
  release: 'neither of the above.',
  falseAlarms: 'With eight rules running on many charts, an occasional chance alarm is expected even when nothing is wrong. Look for a build where several rules and several charts agree.',
  serviceMessage: 'Message from the analysis service:',
  csvButton: 'How should my file be formatted?',
  csvTitle: 'Spreadsheet file (CSV) format',
  updateCharts: 'Update charts',
  closeLabel: 'Close',
  csvRows: 'One row per coupon. Every build needs exactly 5 coupon rows (5 rows with the same build_id). Row order does not matter; builds are sorted by build_timestamp.',
  csvRequired: 'Required columns (the header names must match exactly):',
  csvOptional: 'Optional print-parameter columns. Each one you include gets its own chart and helps point at the likely cause. Columns you leave out are skipped.',
  csvOther: 'Any other column is ignored. Use numbers only in the number columns (no units), and dates like',
}

// Visible words for the page, kept in one place so they can be read (and checked) together.
// Rule (H-11): plain words first; the standard short form appears once in parentheses on first
// mention; after that the plain words are used. Nothing here is a statistic.

/** The three quality characteristics. `title` + `unit` build the chart titles. */
export const QUALITY = [
  {
    key: 'uts_MPa', title: 'Tensile strength', unit: 'MPa', digits: 1, index: 'cpl',
    indexName: 'Tensile Strength: Capability index for the lower limit (Cpl)',
  },
  {
    key: 'porosity_pct', title: 'Porosity', unit: '%', digits: 3, index: 'cpu',
    indexName: 'Porosity: Capability index for the upper limit (Cpu)',
  },
  {
    key: 'dimensional_dev_mm', title: 'Dimensional deviation', unit: 'mm', digits: 3, index: 'cpk',
    indexName: 'Dimensional Deviation: Capability index for the nearest limit (Cpk)',
  },
]

/** The optional print parameters (single value charts). */
export const PARAMS = {
  chamber_oxygen_ppm: { title: 'Chamber oxygen', unit: 'ppm', digits: 1 },
  laser_power_W: { title: 'Laser power', unit: 'W', digits: 1 },
  scan_speed_mm_s: { title: 'Scan speed', unit: 'mm/s', digits: 1 },
  layer_thickness_um: { title: 'Layer thickness', unit: 'µm', digits: 2 },
  humidity_pct: { title: 'Humidity', unit: '%', digits: 1 },
  powder_bed_temp_C: { title: 'Powder bed temperature', unit: '°C', digits: 1 },
  build_plate_temp_C: { title: 'Build plate temperature', unit: '°C', digits: 1 },
  stress_relief_temp_C: { title: 'Stress relief temperature', unit: '°C', digits: 1 },
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
  parametersHeading: 'Test Parameters',
  datasetLabel: 'Select an example dataset',
  resetHint: 'Puts the four allowed values back and sets Baseline builds back to 20.', // shown as a tooltip on the button (the Parameters box has no grey text)
  fileLabel: 'Upload dataset',
  baselineLabel: 'Baseline builds',
  baselineHelp: 'How many of the earliest builds are used to learn what normal looks like. The control limits are calculated from these builds, and every later build is compared against them.',
  narrowScreen: 'Your screen is narrow, so the charts are small and may need sideways scrolling. Use a wider window or turn your phone sideways for the best view.',
  baselineDefaults: 'Default: 20, minimum: 3.',
  howToRead: 'An index of {threshold} or more means the process meets the specification with margin, and it only counts while the chart is in control.',
  chartsIntro: [
    'Blue shading: Baseline builds used to calculate the limits.',
    'Red diamond: A rule was broken (hover for the build and the rules).',
    'The three lines on each chart: Center line, upper control limit and lower control limit.',
  ],
  paramsHeading: 'Build Parameters: Single Value and Moving Range Charts)',
  noParams: 'No print-parameter columns in this file, so there are no parameter charts and the likely cause is not ranked. Add columns such as chamber_oxygen_ppm or laser_power_W to get them (see the "How should my file be formatted?" button under Upload dataset).',
  noParamsShort: 'No print-parameter columns in this file, so the likely cause is not ranked.',
  qualityHeading: 'Test Parameters: Build Average and Spread Charts',
  notCapableTable: 'The process is not capable, so no build should be released yet. The table is greyed out, and those builds show as not released.',
  flaggedToggle: 'Show only quarantined builds',
  legendIntro: 'Each rule looks for a pattern that is unlikely when the process only has its usual random variation (these are the eight Nelson rules). The build average and single value charts use all eight rules; the spread and moving range charts use rule 1 only.',
  quarantine: 'the build broke a rule on the tensile strength or porosity build average or spread chart.',
  release: 'no rule was broken on this build.',
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

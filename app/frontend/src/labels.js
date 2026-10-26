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
  resetHint: 'Puts the four allowed values back and sets Baseline builds back to 20.', // shown as a tooltip on the button (the Test Parameters box has no grey text)
  fileLabel: 'Upload dataset',
  baselineLabel: 'Baseline builds',
  baselineHelp: 'How many of the earliest builds are used to learn what normal looks like. The control limits are calculated from these builds, and every later build is compared against them.',
  narrowScreen: 'Your screen is narrow, so the charts are small and may need sideways scrolling. Use a wider window or turn your phone sideways for the best view.',
  fewBaseline: 'Few baseline builds: The control limits are rough, so the rules can raise false alarms (for example, many builds close to the center line in a row). Use at least 10 builds when you can (20 or more is best).',
  baselineDefaults: 'Default: 20, minimum: 3.',
  howToRead: 'An index of {threshold} or more means the process meets the specification with margin, and it only counts while the chart is in control.',
  chartsIntro: [
    'Blue shading: Baseline builds used to calculate the limits.',
    'Red diamond: A rule was broken (hover for the build and the rules).',
    'The three lines on each chart: Center line, upper control limit and lower control limit.',
  ],
  paramsHeading: 'Build Parameters: Single Value and Moving Range Charts',
  noParams: 'No print-parameter columns in this file, so there are no parameter charts and the likely cause is not ranked. Add columns such as chamber_oxygen_ppm or laser_power_W to get them (see the "How should my file be formatted?" button under Upload dataset).',
  noParamsShort: 'No print-parameter columns in this file, so the likely cause is not ranked.',
  qualityHeading: 'Test Parameters: Build Average and Spread Charts',
  notCapableTable: 'The process is not capable, so no build should be released yet. The table is greyed out, and those builds show as NOT RELEASED.',
  flaggedToggle: 'Show only quarantined builds',
  legendIntro: 'Each rule looks for a pattern that is unlikely when the process only has its usual random variation (these are the eight Nelson rules). The build average and single value charts use all eight rules; the spread and moving range charts use rule 1 only.',
  quarantine: 'The build broke a rule on the tensile strength or porosity build average or spread chart. (Rules on the dimensional deviation charts are shown in the Rules broken column, but they do not quarantine a build.)',
  release: 'No rule was broken on those charts and the process is capable.',
  notReleased: 'No rule was broken, but the process is not capable, so no build should be released yet.',
  falseAlarms: 'With eight rules running on many charts, an occasional chance alarm is expected even when nothing is wrong. Look for a build where several rules and several charts agree.',
  serviceMessage: 'Message from the analysis service:',
  csvButton: 'How should my file be formatted?',
  codebookLink: 'About the example datasets: Codebook on GitHub',
  csvTitle: 'Spreadsheet file (CSV) format',
  updateCharts: 'Update charts',
  closeLabel: 'Close',
  csvRows: 'One row per coupon. Every build needs exactly 5 coupon rows (5 rows with the same build_id). Row order does not matter; builds are sorted by build_timestamp.',
  csvRequired: 'Required columns (the header names must match exactly):',
  csvOptional: 'Optional print-parameter columns. Each one you include gets its own chart and helps point at the likely cause. Columns you leave out are skipped.',
  csvFactors: 'Two more optional columns, for the Possible Causes analysis. Use one value per build, the same on its 5 coupon rows. Builds that break a rule are left out of that analysis. Columns you leave out are skipped.',
  calcToggle: 'Show the calculations and histograms',
  calcIntro: 'For each measurement: The steps that give the capability index, with the real numbers, and a histogram of the baseline coupons.',
  calcRounding: 'Numbers are rounded for display, so doing the sums by hand can differ in the last digit.',
  histCaption: 'Number of coupons in each range ({n} coupons from {builds} baseline builds)',
  histAxis: 'Dashed purple lines: Lowest and highest allowed values. Solid green line: Process average.',
  calc: {
    mean: { title: 'Process average', words: 'The mean of all coupons in the baseline builds' },
    rbar: { title: 'Average range (R-bar)', words: 'The mean of the ranges of the baseline builds (in each build, the largest coupon minus the smallest)' },
    sigma: { title: 'Within-build standard deviation (sigma-hat)', words: 'Average range / {d2} (a fixed constant for groups of {size} coupons)' },
    cpl: { title: 'Capability index for the lower limit (Cpl)', words: '(Process average − lowest allowed value) / (3 × within-build standard deviation)' },
    cpu: { title: 'Capability index for the upper limit (Cpu)', words: '(Highest allowed value − process average) / (3 × within-build standard deviation)' },
    cp: { title: 'Capability index for the width between the limits (Cp)', words: '(Highest allowed value − lowest allowed value) / (6 × within-build standard deviation)' },
    cpkTwo: { title: 'Capability index for the nearest limit (Cpk)', words: 'The smaller of the lower-limit index and the upper-limit index' },
    cpkOne: { title: 'Capability index for the nearest limit (Cpk)', words: 'The index of the only limit that applies' },
  },
  // H-19: the Possible Causes by Machine and Material Lot section (words only; every number comes from the API)
  causes: {
    heading: 'Possible Causes by Machine and Material Lot',
    intro: 'This checks whether builds differ by machine or by material lot, using one average per build.',
    readFirst: 'Read this first',
    noColumns: 'To see this analysis, add machine_id and material_lot columns to your file (one value per build).',
    skippedHeading: 'These columns could not be used:',
    status: { found: 'Difference found', none: 'No difference found', untested: 'Not tested' },
    plotCaptionTwo: 'Each point is the average of the build averages for one machine and lot; bars show one standard error. Lines that are parallel mean the machine effect is the same in every lot.',
    plotCaptionOne: 'Each point is the average of the build averages for one level; bars show one standard error.',
    plotTitle: 'Average of the build averages',
    allBuilds: 'All builds',
    xMachine: 'Machine',
    xLot: 'Material lot',
    summaryHeading: 'What the numbers say',
    tableLabel: 'Analysis of variance (ANOVA)',
    columns: ['Source', 'Degrees of freedom', 'Sum of squares', 'Mean square', 'F ratio', 'p-value', 'Verdict'],
    sources: { machine: 'Machine', lot: 'Material lot', interaction: 'Machine × lot interaction', error: 'Error (within combinations)' },
    verdictFound: 'Likely a real difference',
    verdictNone: 'No evidence of a difference',
    verdictUntested: 'Not tested',
    unavailable: 'not available',
    tableHelp: 'A small p-value means the difference is unlikely to be chance alone. It does not show what caused it.',
  },
  csvOther:'Any other column is ignored. Use numbers only in the number columns (no units), and dates like',
}

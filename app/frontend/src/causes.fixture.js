// Test-only: API-shaped "factors" blocks (the real wording of the service's notes, messages and
// skipped reasons) used by the wording scans in plain.test.js and plainwords.test.js.
// Not imported by the app.

const NOTES = [
  'This shows association, not cause: a machine or lot that differs may only be linked to the real cause.',
  'Machine and material lot were not assigned at random and usually change in blocks over time, so they are mixed up with time (and with each other); a difference may really be a time effect.',
  'There are only a few builds in each machine and lot combination, so the tests can miss small differences.',
  'Each test uses the 0.05 level and there is no correction for running several tests (9 here), so about 1 false alarm in 20 tests is expected by chance.',
  '8 quarantined builds were left out, so a known cause such as a drift is not blamed on a machine or lot.',
]

const cell = (machine, lot, mean, se, n = 5) => ({ machine, lot, n_builds: n, mean, sd: 0.01, se })
const entry = (p, significant) => ({ df: 2, ss: 0.0004, ms: 0.0002, f: 3.1, p, significant })

function metric(over = {}) {
  return {
    cells: [
      cell('AM-01', 'Ti64-Lot-21', 0.004, 0.001), cell('AM-01', 'Ti64-Lot-22', 0.003, null), cell('AM-01', 'Ti64-Lot-23', 0.0045, 0.001),
      cell('AM-02', 'Ti64-Lot-21', 0.021, 0.002), cell('AM-02', 'Ti64-Lot-22', 0.0214, 0.002),
    ],
    machine_means: [{ level: 'AM-01', n_builds: 12, mean: 0.0037 }, { level: 'AM-02', n_builds: 10, mean: 0.0213 }],
    lot_means: [{ level: 'Ti64-Lot-21', n_builds: 10, mean: 0.0125 }, { level: 'Ti64-Lot-22', n_builds: 10, mean: 0.0122 }, { level: 'Ti64-Lot-23', n_builds: 2, mean: 0.013 }],
    anova: { machine: entry(0.0015, true), lot: entry(0.01, true), interaction: null, error: { df: 18, ss: 0.004, ms: 0.0002 } },
    message: 'no builds in AM-02 / Ti64-Lot-23, so the machine-by-lot interaction cannot be tested (the main effects are tested against the additive model)',
    ...over,
  }
}

function block(over = {}) {
  const m = metric()
  return {
    unit: 'build average', alpha: 0.05, builds_used: 22, builds_excluded: 8,
    machine_levels: ['AM-01', 'AM-02'], lot_levels: ['Ti64-Lot-21', 'Ti64-Lot-22', 'Ti64-Lot-23'], skipped: {}, notes: NOTES, message: null,
    metrics: { uts_MPa: m, porosity_pct: metric({ anova: { machine: entry(0.5, false), lot: entry(0.5, false), interaction: entry(0.6, false), error: null }, message: null }), dimensional_dev_mm: metric({ anova: { machine: entry(null, null), lot: null, interaction: null, error: null } }) },
    ...over,
  }
}

/** Every shape the section has to handle. */
export function factorVariants() {
  const none = { cells: [], machine_means: null, lot_means: null, anova: { machine: null, lot: null, interaction: null, error: null }, message: 'No factor could be analysed.' }
  return [
    block(),
    block({ lot_levels: [], skipped: { material_lot: 'material_lot skipped: build B-7 has more than one material_lot value (Ti64-Lot-21, Ti64-Lot-22); a build must have one value on all its rows' } }),
    block({
      machine_levels: [], metrics: {
        uts_MPa: metric({ cells: [cell(null, 'Ti64-Lot-21', 0.01, 0.001), cell(null, 'Ti64-Lot-22', 0.02, 0.001)], machine_means: null, anova: { machine: null, lot: entry(0.02, true), interaction: null, error: null }, message: null }),
        porosity_pct: metric({ cells: [], machine_means: null, anova: { machine: null, lot: null, interaction: null, error: null }, message: null }),
        dimensional_dev_mm: metric({ machine_means: null, lot_means: null }),
      },
    }),
    block({
      machine_levels: [], lot_levels: [], message: 'No factor could be analysed. machine_id skipped: build B-1 has a blank machine_id value; give every coupon row a value',
      skipped: { machine_id: 'machine_id skipped: build B-1 has a blank machine_id value; give every coupon row a value' },
      metrics: { uts_MPa: none, porosity_pct: none, dimensional_dev_mm: none },
    }),
  ]
}

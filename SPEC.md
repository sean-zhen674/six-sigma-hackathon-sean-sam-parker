# SPEC: Six Sigma Hackathon team project

What your tool IS. Your agent reads this before every task. Where the code and this file
disagree, the code is the bug: change this file first, then the code.

Most of this page is already decided by the event and the [rubric](docs/criteria.md).
**Only the `FILL IN` lines change, and you do not have to write them by hand:** describe your app and ask your agent to update them. They depend on the prompt your team picks at kickoff
(prompts are secret until then, see [`docs/prompts.md`](docs/prompts.md)) and on your team.
The examples after each `FILL IN` show the shape of an answer. They are not hints about the prompts.

## 1. Team and prompt
- **Team name:** AeroPrint
- **Track:** Virtual DL Challenge (7 days), due Fri Oct 23, 3 PM ET. See [`docs/schedule.md`](docs/schedule.md).
- **Prompt we chose:** Prompt 1, Industrial Systems: "3D Printing for Aerospace". An aerospace contractor
  3D-printing titanium brackets is failing client strength tests; design a tool to monitor and flag
  when and whether the printing process is capable of meeting strict aerospace tolerances, and help
  contractors resolve these issues.
- **Our public repo:** github.com/sean-zhen674/six-sigma-hackathon-sean-sam-parker

## 2. User and use case (rubric: scope 5, user and use case 5)
- **User:** the supplier quality engineer at the contractor who signs off each titanium-bracket build
  (Ti-6Al-4V, laser powder-bed fusion) after its 5 witness coupons come back from tensile and
  porosity testing. The additive manufacturing process engineer uses the same screen to see which
  print parameter drifted.
- **Decision the tool helps them make, and when:** when a build's coupon results arrive, before parts
  ship: release the build, retest it, or quarantine it, and whether the printing process is still
  capable of meeting the client's strength and porosity specs (and from which build it stopped being
  capable). For a flagged build, which parameter to investigate first (chamber oxygen, laser power, ...).
- **Why this matches the prompt:** it flags *when* (control charts, build by build) and *whether*
  (Cpk against the aerospace spec) the process can meet tolerance, and points the contractor at the
  drifting parameter so they can fix it.

## 3. Inputs (rubric: minimal inputs 5)
Only what this user can actually measure or already knows. Fewer is better; every input a user
cannot measure costs points.

| Input | Type and units | Where the user gets it |
|---|---|---|
| ONE CSV, one row per coupon, 5 coupons per build. Coupon results: `build_id`, `coupon_id`, `build_timestamp`, `machine_id`, `material_lot`, `uts_MPa`, `yield_MPa`, `elongation_pct`, `porosity_pct`, `dimensional_dev_mm`, `pass_fail` | text IDs, ISO 8601 time; MPa, %, mm; pass/fail | the coupon test lab's report (LIMS export) |
| ...and on the same row, that build's parameters (the same value on all 5 coupon rows): `laser_power_W`, `scan_speed_mm_s`, `layer_thickness_um`, `chamber_oxygen_ppm`, `humidity_pct`, `powder_bed_temp_C`, `build_plate_temp_C` (each the mean over the build's layer log), `stress_relief_temp_C` (post-process) | W, mm/s, µm, ppm, %, °C | the printer's layer log averaged per build, and the heat-treat furnace record, joined on `build_id` |
| Spec limits (defaults built in, user can edit) | UTS LSL 900 MPa (target 950); porosity USL 0.5 % (target 0.2); dimensional deviation ±0.10 mm | the client's purchase spec / drawing |

## 4. The statistics, and why (rubric: valid QC analysis 25)
Say the method in words before any code exists. Load the `stats-first-steering` skill first.
- **Method:** X-bar and R charts on coupon UTS and porosity. One subgroup = the 5 coupons from one
  build (n = 5). Limits come from an in-control baseline (the first 20 builds, in time order) with
  the n = 5 constants A2 = 0.577, D3 = 0, D4 = 2.114, d2 = 2.326:
  X-bar chart CL = X̿, limits X̿ ± A2·R̄; R chart CL = R̄, LCL = D3·R̄ = 0, UCL = D4·R̄.
  Capability uses the within-build sigma, σ̂ = R̄ / d2 (not the overall standard deviation, which
  would give Pp/Ppk): UTS has only a lower spec, so **Cpl = (X̿ − LSL) / (3σ̂)**; porosity has only
  an upper spec, so **Cpu = (USL − X̿) / (3σ̂)**; dimensional deviation is two-sided, so
  **Cp = (USL − LSL) / (6σ̂)** and **Cpk = min(USL − X̿, X̿ − LSL) / (3σ̂)**.
  Supporting **I-MR charts** on each build's mean chamber oxygen and mean laser power (and the other
  build parameters): CL = mean, σ̂ = MR̄ / 1.128, limits CL ± 3σ̂; MR chart UCL = 3.267·MR̄.
  **All 8 Nelson rules** flag points on the X-bar and I charts, with zones at 1, 2 and 3 sigma of the
  plotted point (X-bar chart: σ_x̄ = σ̂/√5 = A2·R̄/3; I chart: σ̂ = MR̄/1.128):
  1 = 1 point beyond 3σ; 2 = 9 in a row on one side of CL; 3 = 6 in a row steadily rising or falling;
  4 = 14 in a row alternating up and down; 5 = 2 of 3 in a row beyond 2σ on the same side;
  6 = 4 of 5 in a row beyond 1σ on the same side; 7 = 15 in a row within 1σ (either side);
  8 = 8 in a row beyond 1σ (either side, none within 1σ). The R and MR charts use rule 1 only
  (beyond UCL), because their distribution is skewed and their LCL is 0, so the symmetric zone rules
  do not apply. The flag lands on the point that completes the pattern.
  **Process capable** = every charted quality characteristic is in control AND each index ≥ 1.33.
  If the chart is out of control, the index is printed but marked "not reliable".
  **Build disposition:** QUARANTINE if the build breaks a rule on the UTS or porosity X-bar/R chart;
  RETEST if it is in control but any coupon is outside spec; otherwise RELEASE.
  **Investigate first:** for a flagged build, list the build parameters whose I-MR chart breaks a rule
  at that build, ranked by |z| = |x − CL| / σ̂ (largest first).
- **Why it fits the use case:** the 5 coupons per build are a natural rational subgroup, so X-bar/R
  separates build-to-build shifts from within-build scatter, and Cpl/Cpu answer the client's one-sided
  "at least 900 MPa" and "at most 0.5 % porosity" requirements directly.
- **Assumptions and how the tool checks them:** (1) coupons within a build are a rational subgroup:
  the function refuses builds that do not have exactly 5 coupons, with a message; (2) values are
  roughly normal: a Shapiro-Wilk test on the baseline coupons is reported, and porosity (bounded at
  0, often right-skewed) carries a warning that its Cpu is approximate; (3) the baseline builds are in
  control: limits are computed on the baseline only and the baseline's own violations are shown;
  (4) builds are independent and in time order (sorted by `build_timestamp`).
- **Known-answer check:** hand calculation, 3 builds of 5 UTS coupons (MPa):
  B1 = 945, 952, 950, 948, 955; B2 = 951, 953, 955, 957, 959; B3 = 939, 951, 945, 947, 943.
  Means 950, 955, 945 → X̿ = 2850 / 3 = **950.0**. Ranges 10, 8, 12 → R̄ = 30 / 3 = **10.0**.
  X-bar UCL = 950 + 0.577·10 = **955.77**, LCL = 950 − 5.77 = **944.23**.
  R chart UCL = 2.114·10 = **21.14**, LCL = **0**. All 3 builds in control.
  σ̂ = 10 / 2.326 = **4.2992**. Cpl (LSL 900) = 50 / (3·4.2992) = 50 / 12.8977 = **3.877**.
  Same data against a two-sided test spec 930-970: Cp = 40 / (6·4.2992) = **1.551**,
  Cpk = min(20, 20) / 12.8977 = **1.551**; Cpu (USL 970) = 20 / 12.8977 = **1.551**.
  I-MR on oxygen ppm 100, 120, 110, 130, 140: CL = **120**, moving ranges 20, 10, 20, 10 →
  MR̄ = **15**, σ̂ = 15 / 1.128 = **13.298**, UCL = **159.89**, LCL = **80.11**, MR UCL = 3.267·15 = **49.005**.
  Degenerate cases: 5 identical coupons in every build → R̄ = 0, σ̂ = 0, so Cp/Cpk are undefined:
  return None with the message "zero within-build variation", never inf or 0. A build with 1 coupon,
  or fewer than 2 builds, raises a clear ValueError. Planted signal: a build whose mean UTS is 920
  against the limits above must be flagged by Nelson rule 1; 9 build means all at 951 (above CL 950,
  inside 1σ_x̄ = 1.923) must flag rule 2 on the 9th; means 946, 947, 948, 949, 950, 951 must flag rule 3 on the 6th.

Fixed for every team:
- The statistic lives in **one plain, tested function** (`app/qc.py` or `app/qc.R`). The API, app or
  package only calls it and displays the result. No statistics inside UI code.
- Every statistic has a test against a known answer and a degenerate case (constant data, n = 1, missing values).
- You can explain every number the tool prints. If you cannot, it is not done.

## 5. Delivery (rubric: working tool 25)
- **Stack:** Python REST API (FastAPI) whose endpoints call `app/qc.py`, plus a React (Vite)
  dashboard in `app/frontend/` that calls the API. Two pieces of content on Posit Connect: the API
  first, then the static React build pointed at the API's URL (one line in `src/config.js`).
- **Starting demo:** `demos/fastapi/` copied to `app/`; `demos/reactfront/` copied to `app/frontend/`.
  If the clock runs short, the API's `/docs` page is the fallback front end.

Fixed for every team:
- Start from **one** demo in `demos/`, copied to `app/`. Keep its four-script contract
  (`testme`, `manifestme`, `deployme`, `README.md`); `testme` starts the tool with one command.
- Deployed on the course **Posit Connect** server with a public URL (publisher key handed out at the
  event). Deploy early: copy one workflow from
  [`.claude/skills/connect-publish/workflows/`](.claude/skills/connect-publish/workflows/).
- A small tool that runs beats a large tool that does not.

## 6. Outputs
- **What the user sees:** on one React dashboard page, after picking a test dataset or uploading a CSV:
  - a banner "Process capable: YES / NO", with Cpl for UTS, Cpu for porosity and Cpk for
    dimensional deviation (unitless; ≥ 1.33 = capable), plus the first build where it stopped being in control;
  - X-bar and R charts for UTS (MPa) and porosity (%), with rule-breaking builds in red;
  - I-MR charts for chamber oxygen (ppm) and laser power (W);
  - a build table: build_id, RELEASE / RETEST / QUARANTINE, the rule broken, and "investigate first: <parameter>".
  How to read this: "A red point means that build behaved differently from the baseline builds;
  an index of 1.33 or more means the process meets spec with margin, and only counts while the chart is in control."
  The same numbers come back as JSON from the API.

## 7. Test datasets and codebook (rubric: demo 10, datasets 5, codebook 5)
2-3 small CSVs in `data/`, invented but shaped like real field data, each showing one behavior.
`data/README.md` is the codebook: every file, every column with units, and what it would take to
collect this data for real.
- **Datasets:** seeded simulations, 30 builds × 5 coupons each:
  `capable_baseline.csv` (in control, Cpl and Cpu ≥ 1.33); `oxygen_drift.csv` (chamber oxygen creeps up
  from build 21, so UTS falls and porosity rises, flagged by rules 2/3 before parts fail spec);
  `laser_power_excursion.csv` (laser power drops about 15 % on builds 24-26, so porosity spikes,
  flagged by rule 1). The seed and generator script are recorded in `data/README.md`.

## 8. Documentation and reproducibility (rubric: docs 10, public repo 5)
- `README.md` says what the tool does, for whom, every input and parameter, how to run it in one
  command, and walks through the demo on each test dataset.
- Public GitHub repo; a fresh clone runs `testme` and the tests pass with no extra steps.
- Submit on Devpost: the repo link plus a demo.

## 9. Out of scope
What we will NOT build, so nobody (human or agent) builds it by accident.
- Default: logins, databases, real customer data, a second statistic before the first one is tested.
- No reliability, MTTF or fault-tree analysis (a stretch goal only after H-01 to H-08 are done).
- No regression or DOE root-cause model: "investigate first" is the I-MR z-score ranking only.
- No forecasting, no machine-to-machine or plant-to-plant comparison, no layer-by-layer chart (layers
  are summarised per build), no powder PSD/morphology or HIP parameters (not in the data).

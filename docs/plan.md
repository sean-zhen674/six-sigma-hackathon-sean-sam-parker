# AeroPrint plan (deadline Fri Oct 23, 3 PM ET)

User: the supplier quality engineer releasing Ti-6Al-4V bracket builds. Question: is the print
process capable of the aerospace spec, since when not, and what should be done with this build?

## Statistics (formulas: SPEC.md section 4; n = 5 coupons per build, baseline = builds 1-20)
- X-bar chart: CL = X̿, limits X̿ ± A2·R̄ (A2 = 0.577). R chart: UCL = D4·R̄ (2.114), LCL = 0.
- σ̂ = R̄ / d2 (2.326). Cpl = (X̿ − LSL)/3σ̂ (UTS); Cpu = (USL − X̿)/3σ̂ (porosity);
  Cp = (USL − LSL)/6σ̂, Cpk = min(USL − X̿, X̿ − LSL)/3σ̂ (dimensional). σ̂ = 0 gives None, never inf.
- I-MR: CL = mean, σ̂ = MR̄/1.128, limits CL ± 3σ̂; MR UCL = 3.267·MR̄.
- Nelson rules 1-8 on X-bar and I charts (zones at σ̂/√n or σ̂); R and MR charts use rule 1 only.
- Disposition: QUARANTINE (rule broken on UTS/porosity X-bar or R) > RETEST (any coupon out of spec) > RELEASE.
- Investigate first: parameters out of control at that build, ranked by |x − CL|/σ̂.

## Tasks, in order
1. **H-01 SPEC** (owns SPEC.md), 0 h left. Test: `grep -c "FILL IN[.,]" SPEC.md` prints 0; team reads it.
2. **H-03 qc.py** (owns app/qc.py, app/requirements.txt, tests/), 2.5 h. Plain functions taking a
   pandas DataFrame or list: `xbar_r`, `capability`, `imr`, `nelson`, `disposition`, `rank_parameters`, `analyze`.
   Known answer: the 3-build UTS example → X̿ 950.0, R̄ 10.0, UCL 955.77, LCL 944.23, R UCL 21.14,
   σ̂ 4.2992, Cpl 3.877, Cp/Cpk/Cpu (930-970) 1.551; I-MR oxygen → CL 120, MR̄ 15, UCL 159.89, LCL 80.11.
   One planted series per Nelson rule (1-8) flags on the exact point; a clean series flags nothing.
   Degenerate: constant coupons → Cp/Cpk None + message; 1 coupon per build or < 2 builds → ValueError.
3. **H-02 data** (owns data/), 1 h, in parallel with H-03. `data/generate.py` (seed 5300) writes
   capable_baseline.csv, oxygen_drift.csv, laser_power_excursion.csv (30 builds × 5 coupons) and
   `data/README.md` codebook. Test: ls shows 3 CSVs; the codebook covers every column with units.
4. **H-04 API** (owns app/), 1.5 h. Copy demos/fastapi → app/. Routes: GET `/health`, GET `/datasets`,
   GET `/analyze/{dataset}`, POST `/analyze` (CSV upload). Test: testme in the background, curl
   on the known-answer CSV returns the H-03 numbers; a bad CSV returns 422 with a message.
5. **H-06 deploy API** (owns .github/workflows/, .github/scripts/, app/manifest.json), 1 h, right
   after H-04. Repo already public (H-08, first half). Needs CONNECT_SERVER/CONNECT_API_KEY secrets.
6. **H-05 dashboard + demo** (owns app/frontend/, demo/), 3 h. Copy demos/reactfront → app/frontend/;
   Plotly.js charts; banner, 4 charts, build table; API URL in `src/config.js`. Then deploy it
   static (deploy-react-static.yml, H-06 files). demo/README.md walks all 3 datasets.
   Test: Playwright opens the page, reads the banner and Cpl, matches the API JSON.
7. **H-07 README** (owns README.md, app/README.md), 1 h. Every input, endpoint, function, live URLs.
8. **H-08 submit** (owns .gitignore), 0.5 h. Fresh clone: testme + pytest pass; no key in git; Devpost.

## Decisions
- Front end: React (Vite) in app/frontend/, separate static deploy; /docs is the fallback.
- Data: one CSV per scenario, one row per coupon, build parameters repeated on each row.
- Capable: every index ≥ 1.33 AND in control; limits from builds 1-20 only.
- Run rules: all 8 Nelson rules on X-bar and I charts; rule 1 only on R and MR charts (agent choice, stated in SPEC).

## Risks
1. Time (~1 day). Stats and API first; if the React page isn't live by Fri 10 AM, ship /docs and submit.
2. 8 rules raise false alarms (rule 7 fires on very tight data). The generator uses realistic noise,
   and the capable baseline must flag nothing; if it does, we explain that build in demo/README.md.
3. Porosity is bounded at 0 and skewed, so its Cpu is approximate: Shapiro-Wilk is reported with a warning.
4. Deploy key: without CONNECT_SERVER/CONNECT_API_KEY, H-06 is blocked. Get them early.

## H-09 decisions (dashboard usability pass, asked 2026-10-22)
- Layout: keep the current order (banner, charts, parameters, table, legend).
- Banner: unreliable indices are greyed out with a warning and "do not rely on this".
- Explain: one plain-English summary sentence under the banner (wording only, from API fields), a one-line help text under each chart, a dismissible first-visit tour, dataset descriptions in the picker.
- Spec limits: editable on every dataset (GET /analyze/{dataset} accepts the same spec params as POST /analyze).

## H-10 decisions (upload format, asked 2026-10-22)
- Required CSV columns: build_id, build_timestamp, uts_MPa, porosity_pct, dimensional_dev_mm (5 coupons per build).
- The 8 print parameters are optional; present ones are charted and ranked, missing ones skipped with a note.
- The sample CSVs keep their extra columns; the tool ignores anything it does not use.
- Guide: docs/csv-format.md + template CSV, an in-page help panel with a template download, friendlier upload errors.

## H-11 decisions (plain words, asked 2026-10-22)
- Spell out abbreviations on the dashboard; the standard symbol appears once in parentheses on first mention (for example "Capability index for the lower limit (Cpl)").
- Scope: the dashboard page only. README, SPEC and the guide keep their wording.

## H-12 decisions (controls panel redesign, asked 2026-10-22)
- Header: remove the subtitle sentence; add a GitHub repository link; keep "Take the tour".
- Box 1 "dataset": label "Select an example dataset" (dropdown shows Title Case names without underscores), its description, then "Upload dataset" on its own line underneath.
- Box 2 "settings", below box 1: baseline builds (with a small grey explanation), then Tensile Strength: Lowest Allowed (MPa); Porosity: Highest Allowed (%); Dimensional Deviation: Lowest Allowed (mm) and Highest Allowed (mm) on the same line; buttons on one line.
- Units abbreviated in these labels at the team's request.

## Reminder (asked 2026-10-22)
- When all dashboard work is done: UPDATE THE README (root README.md, then check app/README.md, demo/README.md, docs/csv-format.md, SPEC.md sections 3 and 6) before merging to main and before the final submission steps (H-08).

## H-13 decisions (layout round 2, asked 2026-10-22)
- Dataset box and Parameters box side by side on wide screens, stacked on narrow ones.
- Settings box title becomes "Parameters".
- Baseline builds moves out of the Parameters box into the Control charts section (with its grey explanation); changing it re-runs the analysis.
- The CSV format instructions move under the Upload dataset button and open as a popup window.
- The dataset description loses its early line break (width cap removed).

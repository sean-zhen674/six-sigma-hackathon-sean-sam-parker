# AeroPrint plan (deadline Fri Oct 23, 3 PM ET)

User: the supplier quality engineer releasing Ti-6Al-4V bracket builds. Question: is the print
process capable of the aerospace spec, since when not, and what should be done with this build?

## Statistics (formulas: SPEC.md section 4; n = 5 coupons per build, baseline = first 20 builds by default, adjustable, minimum 3)
- X-bar chart: CL = X̿, limits X̿ ± A2·R̄ (A2 = 0.577). R chart: UCL = D4·R̄ (2.114), LCL = 0.
- σ̂ = R̄ / d2 (2.326). Cpl = (X̿ − LSL)/3σ̂ (UTS); Cpu = (USL − X̿)/3σ̂ (porosity);
  Cp = (USL − LSL)/6σ̂, Cpk = min(USL − X̿, X̿ − LSL)/3σ̂ (dimensional). σ̂ = 0 gives None, never inf.
- I-MR: CL = mean, σ̂ = MR̄/1.128, limits CL ± 3σ̂; MR UCL = 3.267·MR̄.
- Nelson rules 1-8 on X-bar and I charts (zones at σ̂/√n or σ̂); R and MR charts use rule 1 only.
- Disposition (three words since H-21): QUARANTINE (rule broken on UTS/porosity X-bar or R); NOT RELEASED (no rule broken, process not capable); RELEASE (no rule broken and the process is capable).
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
   capable_baseline.csv, oxygen_drift.csv, marginal_spread.csv (30 builds × 5 coupons) and
   `data/README.md` codebook. Test: ls shows 3 CSVs; the codebook covers every column with units.
4. **H-04 API** (owns app/), 1.5 h. Copy demos/fastapi → app/. Routes: GET `/health`, GET `/datasets`,
   GET `/analyze/{dataset}`, POST `/analyze` (CSV upload). Test: testme in the background, curl
   on the known-answer CSV returns the H-03 numbers; a bad CSV returns 422 with a message.
5. **H-06 deploy API** (owns .github/workflows/, .github/scripts/, app/manifest.json), 1 h, right
   after H-04. Repo already public (H-08, first half). Needs CONNECT_SERVER/CONNECT_API_KEY secrets.
6. **H-05 dashboard + demo** (owns app/frontend/, demo/), 3 h. Copy demos/reactfront → app/frontend/;
   hand-drawn SVG charts (not Plotly.js); banner, charts, build table; API URL in `src/config.js`. Then deploy it
   static (deploy-react-static.yml, H-06 files). demo/README.md walks all 3 datasets.
   Test: Playwright opens the page, reads the banner and Cpl, matches the API JSON.
7. **H-07 README** (owns README.md, app/README.md), 1 h. Every input, endpoint, function, live URLs.
8. **H-08 submit** (owns .gitignore), 0.5 h. Fresh clone: testme + pytest pass; no key in git; Devpost.

## Decisions
- Front end: React (Vite) in app/frontend/, separate static deploy; /docs is the fallback.
- Data: one CSV per scenario, one row per coupon, build parameters repeated on each row.
- Capable: every index ≥ 1.33 AND in control; limits from the baseline builds only (default the first 20, adjustable, minimum 3; a note appears below 10).
- Run rules: all 8 Nelson rules on X-bar and I charts; rule 1 only on R and MR charts (agent choice, stated in SPEC).

## Risks
1. Time (~1 day). Stats and API first; if the React page isn't live by Fri 10 AM, ship /docs and submit.
2. 8 rules raise false alarms (rule 7 fires on very tight data). The generator uses realistic noise,
   and the capable baseline must flag nothing; if it does, we explain that build in demo/README.md.
3. Porosity is bounded at 0 and skewed, so its Cpu is approximate: Shapiro-Wilk is reported with a warning.
4. Deploy key: without CONNECT_SERVER/CONNECT_API_KEY, H-06 is blocked. Get them early.

## H-09 decisions (dashboard usability pass, asked 2026-10-22)
- Layout: keep the then-current order (banner, charts, parameters, table, legend). Replaced by the order under "H-16 current state" below.
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
- Box 2 "settings", below box 1 (later the Test Parameters box; baseline builds moved out in H-13): then Tensile Strength: Lowest Allowed (MPa); Porosity: Highest Allowed (%); Dimensional Deviation: Lowest Allowed (mm) and Highest Allowed (mm) on the same line; buttons on one line.
- Units abbreviated in these labels at the team's request.

## Reminder (asked 2026-10-22)
- When all dashboard work is done: UPDATE THE README (root README.md, then check app/README.md, demo/README.md, docs/csv-format.md, SPEC.md sections 3 and 6) before merging to main and before the final submission steps (H-08).

## H-13 decisions (layout round 2, asked 2026-10-22)
- Dataset box and Test Parameters box side by side from 900 px, stacked below that.
- Settings box title becomes "Parameters" (renamed "Test Parameters" later).
- Baseline builds moves out of the Test Parameters box into the Control Charts section (with its grey explanation); changing it re-runs the analysis.
- The CSV format instructions move under the Upload dataset button and open as a popup window.
- The dataset description loses its early line break (width cap removed).

## H-14 decisions (capability wording and a not-capable example, asked 2026-10-22)
- A capability index below 1.33 reads "Below the minimum of 1.33: Not capable"; the separate out-of-control reliability line is removed (an out-of-control chart still shows the warning on its index).
- New example dataset marginal_spread: in control on every build, but dimensional Cpk is about 1.19, so the process is not capable. The three older CSVs and their numbers do not change. (Cpk is 1.04 after H-18; three datasets and a 7-file manifest after the laser_power_excursion removal)
- The chart intro becomes short bullets. (Later the extra dataset was removed again: the event asks for 2 to 3 datasets, so there are three.)

## H-15 decisions (one question: is the process capable? asked 2026-10-23)
- The third disposition is removed, together with the coupon-out-of-specification check and its API field. A build is QUARANTINE if a rule was broken on the UTS or porosity X-bar or R chart, otherwise RELEASE (H-21 later adds NOT RELEASED in the API).
- When the process is not capable the dashboard greys the build table and shows RELEASE builds as NOT RELEASED (QUARANTINE stays QUARANTINE). Since H-21 the API itself sends NOT RELEASED and the page no longer relabels anything.
- Capability indices and process_capable do not change.

## Later polish decisions (2026-10-23)
- Baseline builds: default 20, minimum 3 (page and API); below 10 builds a yellow note and an API warning say the limits are rough. The page note follows settings.baseline_n_used, the number the API really used.
- Summary box: the one-sentence summary sits in its own Summary box under the banner.
- Control Charts: one drop-down row per measure or parameter, each showing "Rule broken" or "No rule broken" even when closed.
- Hover details: pointing at (or tapping) a point shows the build, the value with its unit and the rules it broke.
- Unit symbols everywhere (MPa, %, mm, ppm, W, mm/s, µm, °C), not spelled-out units.
- Moving range wording: "How much the value changed from one build to the next."
- Headings: Test Parameters: Build Average and Spread Charts; Build Parameters: Single Value and Moving Range Charts (the user's choice).

## H-16 current state (consistency pass, 2026-10-23)
- Page order: Dataset and Test Parameters boxes side by side, the banner (Process Capable? Yes or No) with the calculations and histograms toggle (H-17, open by default), Summary, Control Charts (Baseline builds input, quality charts, build parameter charts), Possible Causes by Machine and Material Lot (H-19), the builds table, then "What the rules mean".
- Charts are hand-drawn SVG (no Plotly.js). The control charts do not draw the allowed-value lines (the dead code for them was removed); the histograms in the calculations toggle do draw them (dashed).
- Three datasets: capable_baseline, oxygen_drift, marginal_spread.
- README files are rewritten last, after the team approves the dashboard.

## H-17 decisions (calculations and histograms toggle, 2026-10-25)
- Team request: inside the Process Capable box, a toggle shows the calculation and a histogram for each measurement, with lines for the allowed values and the process average.
- API: capability[metric].histogram = {edges, counts, n, n_builds} of the individual coupons of the baseline builds (the same coupons as the process average and sigma-hat). Bins by Sturges' rule, ceil(log2 n) + 1, at least 5 and at most 30, equal width over [min, max]. All values equal gives one bin with edges [v, v]; fewer than 2 values gives null. No existing number changes (checked by saving the analysis of the three datasets at baseline 20 and 3 before and after: identical once the histogram keys are removed).
- Page: an open-by-default details element "Show the calculations and histograms". Each block lists the steps with the API's numbers (process average, average range, sigma-hat = average range / 2.326, then only the indices that exist) and the verdict from the API's capable and reliable fields. The page only joins and rounds numbers; it adds no statistic.
- Histogram: hand-drawn SVG, no vertical numbers, a caption with the coupon and build counts, dashed purple lines for the allowed values, a solid green line for the process average, labels on separate rows so none overlap, hover or tap tooltip.

## H-18 decisions (possible causes: two-way ANOVA of machine and material lot, 2026-10-25)
- Team question: is failure or quality linked to a machine or a material lot, and do the two interact? `machine_id` and `material_lot` become optional used columns (SPEC section 3); both absent leaves the analysis unchanged and `factors` is null.
- Method (SPEC section 4): two-way ANOVA with interaction, Type II sums of squares by least-squares model comparison, on build averages (machine and lot are set per build; the builds in a combination are the replicates). Quarantined builds are left out so a known cause such as the oxygen drift is not blamed on a lot. alpha 0.05, no multiplicity correction. Degenerate cases give None plus a message, never NaN or inf. API: only new keys (`factors`, `settings.factors_missing`); every existing number is unchanged on capable_baseline and oxygen_drift (analysis saved before and after at baseline 20 and 3, identical once the new keys are removed).
- Tests: a hand-computed 2 x 2 (SSA 144.5, SSB 12.5, SSAB 12.5, SSE 36, F 16.056 and 1.389, p 0.016037 and 0.303912); the balanced 2 x 3 sample layout against the textbook formulas; a one-way check against scipy f_oneway; an unbalanced check against an independent least-squares comparison.
- Limitation stated in the output: in the sample files machine (blocks of 5 builds) and lot (blocks of 10) change with time and were not randomised, so they are mixed up with time. It is an association, not a cause.
- PLANTED EFFECT, disclosed: in marginal_spread only, every coupon of a build run on machine AM-02 has +0.025 mm added to its dimensional deviation (data/generate.py, DIM_MACHINE_SHIFT). Honest note on the size: it was chosen after a scan at seed 5336, only to be large enough to detect with 5 builds per machine and lot combination while raising no control chart alarm. 0.015 mm (tried first) raised no alarm but gave machine p = 0.135; 0.020 gave p = 0.017; 0.025 gave p = 0.0015 (also below 0.05/9 = 0.0056, so it survives a Bonferroni correction over the 9 tests) and no alarm; 0.030 raised an alarm. The seed (5336) and the random stream are unchanged; capable_baseline.csv and oxygen_drift.csv are byte-identical. marginal_spread's dimensional numbers change: process average 0.0006 to 0.0131 mm, Cpl 1.206 to 1.356, Cpu and Cpk 1.192 to 1.042; Cp (1.199), sigma-hat (0.0278 mm) and the R chart do not change; the Shapiro-Wilk warning on the dimensional baseline disappears (p 0.0075 to 0.373). ANOVA on dimensional deviation: machine F = 12.77, p = 0.0015 (AM-01 mean 0.0037 mm, AM-02 0.0214 mm), lot F = 0.13, p = 0.88, interaction F = 0.09, p = 0.92. UTS and porosity show nothing (all p > 0.17).

## H-19 decisions (possible causes panel and two tour steps, 2026-10-25)
- New section "Possible Causes by Machine and Material Lot" between Control Charts and Builds (Causes.jsx, InteractionPlot.jsx, pure helpers and tests in causes.js / causes.test.js). All words come from labels.js (TEXT.causes) and the API's `factors` block; the page adds no statistic. Significance is the API field `significant`. The only arithmetic is the difference of two displayed means in the summary sentence.
- Status per measurement: red "Difference found" if any of machine, lot or interaction has significant true; green "No difference found" if some effect was tested and none is significant; "Not tested" if nothing could be tested (null p, F or significant, null entries). Each status has a symbol and words. Only the measurement with a significant effect opens, otherwise the first.
- Interaction plot: hand-drawn SVG, one line per machine across the lots, circle / square / triangle markers and different dashes, direct labels at the line ends, a key, bars of one standard error (skipped when `se` is null), a gap where a combination has no builds. One factor gives a single line. The API notes are shown as a list (capital letter after each colon is added by capitalizeAfterColon), with "Association, not cause." above them.
- Null handling decided: `factors` null gives one short note with a link to the file-format window; no usable factor shows `message` and the `skipped` reasons; a null interaction (oxygen_drift) is a "Not tested" row with the API message under the table; a one-factor file has no interaction row.
- Tour: 8 steps after H-20 (6 when H-19 was written). Two new steps, "See the calculations" (target id calc-toggle) and "Look for possible causes" (target id causes-h). A step with a target scrolls to it, outlines it, and docks the window to the bottom of the screen so the target stays visible; no target on the page means the step just shows its text. Other steps are unchanged.
- Bug found in the browser check: a hidden table for screen readers widened the page to 664 px at 375 px; it now sits inside a hidden div.

## H-20 decisions (criteria gaps on the dashboard, 2026-10-25)
- Why: docs/criteria.md awards points for a clear user and use case, a clear demonstration with test datasets, excellent documentation, and a codebook and README for the datasets. The dashboard itself now points to each.
- Tour: 8 steps. New first step "What AeroPrint is for" (no target, centred) names the user, the decisions and the example datasets. New last step "Read the full documentation" (no target) has an optional `link: { href, label }` rendered as an underlined anchor in the dialog. The Tab trap now includes that anchor, so the link is reachable by keyboard and Tab still wraps.
- Dataset box: link "About the example datasets: Codebook on GitHub" (capital C because the page rule is a capital after every colon). Addresses README_URL and CODEBOOK_URL live in format.js with an exact-string test.
- The CSV format popup was not changed. It has no link to a "full guide", only the two template downloads, which still work.
- Page-side only; no statistic changed. README files are written separately.

- Reminder (asked 2026-10-23): at the very end run ONE full consistency pass over all files (stale wording, thresholds, dead code, test names, docs against code, screenshots), then update the README files, then ask before H-08. Do not repeat the audit after every small change; it is expensive.

## H-21 decisions (NOT RELEASED in the analysis service and the final audit fixes, 2026-10-25)
- Option B, chosen by the team: the analysis service says NOT RELEASED itself. `disposition` is exactly one of three strings: QUARANTINE (a rule broke on the UTS or porosity X-bar or R chart), NOT RELEASED (no rule broke, but process_capable is false or undefined), RELEASE (no rule broke and the process is capable). A broken rule is never hidden by the capability decision. Rules on the dimensional deviation charts are listed in rules_broken but do not quarantine (qc.QUARANTINE_COLUMNS).
- Design: `disposition(rules_broken)` stays pure and unchanged (rules only). A second tiny pure function `apply_capability(verdicts, process_capable)` turns RELEASE into NOT RELEASED unless process_capable is True (so None gives NOT RELEASED); `analyze()` calls both after process_capable is known.
- Expected on the real data: capable_baseline 30 RELEASE; oxygen_drift 8 QUARANTINE (B-1023 to B-1030) and 22 NOT RELEASED; marginal_spread 30 NOT RELEASED.
- Proof nothing else changed: the analysis of the three datasets was saved at baseline 20 and 3 before the edit; after mapping NOT RELEASED back to RELEASE the JSON is identical (91 builds mapped).
- Page: the relabelling in BuildTable is removed; the badge shows the API word (NOT RELEASED: grey, dashed, with an icon and the words). The greyed table and its note stay when the process is not capable. The quarantined-builds filter stays QUARANTINE only. The legend lists three dispositions.
- Also: the file-format window lists machine_id and material_lot; manifest checksums are computed from LF copies of the files (see the manifest test); dataset descriptions and tour/test wording fixes from the audit.

## README requirements (asked 2026-10-25; the README writer must follow these)
- The README is the FULL documentation: every function (inputs, parameters, outputs, errors), every endpoint, the file format, the method and assumptions, how to run, test and deploy.
- It holds the clear demonstration with the three test datasets (screenshots and what to look for), as the tour's last step points people to it.
- The dataset codebook lives in data/README.md (every file and variable, units, ranges, how the data would be collected for real, the simulation seeds, the disclosed planted machine effect); the root README links to it and summarises it.
- State the user and use case up front (supplier quality engineer who releases builds; additive manufacturing process engineer).
- Marginal Spread: NO build may be described as released. The process is not capable (dimensional Cpk 1.04, below 1.33), so every one of its 30 builds shows as NOT RELEASED on the dashboard. Say so wherever the dataset is described (README, demo walkthrough, data codebook, tables). Explain that since H-21 the API's per-build `disposition` is QUARANTINE (a rule broke), NOT RELEASED (no rule broke but `process_capable` is false) or RELEASE (no rule broke and the process is capable), so Marginal Spread has no RELEASE in the API either.

# AeroPrint demo walkthrough

AeroPrint tells a supplier quality engineer whether the titanium-bracket print process is in
control and capable (Cpl for UTS, Cpu for porosity, Cpk for dimensional deviation, all against
1.33), from which build it stopped being in control, and what to do with each build (RELEASE
or QUARANTINE). Every number below was copied from a real run of the API and the page.
The statistics live only in `app/qc.py`; the page only draws what the API returns.

## The three datasets at a glance

| Dataset (`data/`) | Process capable? | Cpl (UTS) | Cpu (porosity) | Cpk (dimensional) | First out-of-control build | Quarantined builds | Top suspect |
|---|---|---|---|---|---|---|---|
| `capable_baseline` | YES | 4.81 | 3.70 | 1.79 | none | none | none |
| `oxygen_drift` | NO | 4.64 (not reliable) | 3.51 (not reliable) | 1.42 (meets the minimum) | B-1023 | B-1023 to B-1030 (8 builds) | chamber_oxygen_ppm (z = 9.4 at B-1023, 52.3 at B-1030) |
| `marginal_spread` | NO | 4.81 (meets the minimum) | 3.70 (meets the minimum) | 1.19 (below the minimum: not capable) | none | none (all 30 RELEASE) | none |

"Not reliable" means the chart is out of control, so the index is printed but does not count.
Limits come from the first 20 builds (B-1001 to B-1020).

## What is on the page (top to bottom)

- **Header:** the title *AeroPrint* (no subtitle), a *GitHub repository* link (opens the project repository in a new tab) and a *Take the tour* button that reopens the 4-step guided tour (it opens by itself on the first visit; Escape or *Skip* closes it).
  Screenshot: [`screenshots/tour_step1.png`](screenshots/tour_step1.png)
- **Controls, two boxes side by side.** From about 900 px wide, box 1 *Dataset* (left) and box 2 *Test Parameters* (right) sit next to each other at equal height; on narrower screens and phones they stack with *Dataset* first. Box 1: *Select an example dataset* (the dropdown shows *Capable Baseline*, *Oxygen Drift* and *Marginal Spread*) with the description underneath (it fills the box width), then *Upload dataset* on its own line (a note says *Using your file: ...* while a file is in use) and directly under it a small link-style button *How should my file be formatted?* that opens the *Spreadsheet file (CSV) format* popup (required and optional columns, the 5-coupons-per-build rule, template downloads, link to the full guide; close it with *Close*, Escape or a click on the dark area). Box 2, *Parameters*, one item per line and with no grey helper text: *Tensile Strength: Lowest Allowed (MPa)*, *Porosity: Highest Allowed (%)*, then *Lowest Allowed (mm)* and *Highest Allowed (mm)* side by side under the heading *Dimensional Deviation* (their full names are *Dimensional Deviation: Lowest Allowed (mm)* and *Dimensional Deviation: Highest Allowed (mm)*); all four boxes are the same width, always editable and filled from the service defaults. Then *Run again* and *Reset to defaults* on one line (*Reset to defaults* puts the four boxes back and sets *Baseline builds* back to 20, as its hover text says; *Run again* sends the four boxes and the current *Baseline builds*). *Baseline builds* lives in the *Control charts* section, under the heading and the four-bullet chart key (blue shading, red diamond, the three lines, the values; the chart itself no longer prints a "baseline builds 1 to N" label, the shaded area is described in the chart's screen-reader text) and before the first chart, with its small grey explanation and an *Update charts* button; pressing Enter in the box, leaving the box, or pressing *Update charts* re-runs the analysis (an invalid value such as 3 shows "Baseline builds must be a whole number of at least 5." and sends nothing). Screenshots: [`screenshots/capable_baseline.png`](screenshots/capable_baseline.png) (desktop), [`screenshots/capable_baseline_375px.png`](screenshots/capable_baseline_375px.png) (phone), [`screenshots/baseline_in_charts_section.png`](screenshots/baseline_in_charts_section.png) (the Baseline builds box), [`screenshots/csv_help_panel.png`](screenshots/csv_help_panel.png) and [`screenshots/csv_help_panel_375px.png`](screenshots/csv_help_panel_375px.png) (the popup).
- **Banner:** Process capable YES / NO and the three indices, named *Tensile strength: capability index for the lower limit (Cpl)*, *Porosity: capability index for the upper limit (Cpu)* and *Dimensional deviation: capability index for the nearest limit (Cpk)*. Under each index there is one of three outcomes (H-14): chart out of control gives only the greyed number and the warning "Chart out of control: Do not rely on this number" (no reliability line at all); chart in control and index at or above 1.33 gives "Meets the minimum of 1.33" with a check mark; chart in control and index below 1.33 gives "Below the minimum of 1.33: Not capable" with a warning sign, bold text and a thicker border (not colour alone). The summary then names the measure, for example "No build broke a rule, but Dimensional deviation is below the minimum of 1.33, so the process is not shown to be capable."
- **Summary sentence:** one plain-English line under the banner, for example "From build B-1023 the process went out of control; 8 builds should be quarantined. Most likely cause: chamber oxygen (parts per million)."
- **Charts:** titles such as *Tensile strength: build average chart (X-bar), megapascals*, *Porosity: spread chart (R, the range), percent*, *Chamber oxygen: single value chart (I), parts per million* and *Chamber oxygen: moving range chart (MR), ppm*. Each has a one-line description and, under the chart, a legend that spells out the lines (*Upper control limit*, *Center line*, *Lower control limit*, and *Lowest allowed value* or *Highest allowed value* when drawn). Inside the chart the tags are shortened to *Upper*, *Center* and *Lower*. Then the builds table (*Rules broken* is written in words, for example "Tensile strength build average chart: one build beyond the control limits (Nelson rule 1)") and the rule legend *What the rules mean*.

## Start everything (two terminals, from the repo root)

```bash
# terminal 1: the API on http://localhost:8000  (docs at /docs)
bash app/testme.sh

# terminal 2: the dashboard on http://localhost:5173
cd app/frontend
npm install        # first time only; needs Node 20+
npm run dev
```

The page finds the API through `app/frontend/src/config.js` (default `http://localhost:8000`).
To point a build at another API: `VITE_API_BASE=https://your-api npm run build`.

## Check the API without the page (same numbers)

This one command prints the key numbers for any dataset (run from the repo root; on macOS or
Linux use `.venv/bin/python`):

```bash
curl -s http://localhost:8000/analyze/oxygen_drift | .venv/Scripts/python.exe -c "import sys,json; d=json.load(sys.stdin); c=d['capability']; print('capable', d['process_capable'], '| first out of control', d['first_out_of_control_build']); print('Cpl %.2f Cpu %.2f Cpk %.2f' % (c['uts_MPa']['cpl'], c['porosity_pct']['cpu'], c['dimensional_dev_mm']['cpk'])); [print(b['build_id'], b['disposition'], b['investigate_first'][0]['parameter'] if b['investigate_first'] else '-') for b in d['builds'] if b['disposition'] != 'RELEASE']"
```

Replace `oxygen_drift` with `capable_baseline` or `marginal_spread`.

## 1. `capable_baseline` : the good case

- Page: open http://localhost:5173, choose **Capable Baseline** (`capable_baseline`) in the *Select an example dataset* dropdown (it is the default).
- API: `curl -s http://localhost:8000/analyze/capable_baseline` (command above).
- You see: banner "Process capable: YES", capability indices 4.81 (lower limit, Cpl), 3.70 (upper limit, Cpu) and 1.79 (nearest limit, Cpk), all "reliable", "First out-of-control build: none". No red diamonds; all 30 builds are RELEASE.
- Screenshot: [`screenshots/capable_baseline.png`](screenshots/capable_baseline.png)
- How to read this: nothing is red and every index is above 1.33 while the charts are in control, so the process meets spec with margin.

## 2. `oxygen_drift` : a slow drift

- Page: choose **Oxygen Drift** (`oxygen_drift`) in the dropdown.
- API: `curl -s http://localhost:8000/analyze/oxygen_drift`
- You see: "Process capable: NO", first out-of-control build **B-1023**. The lower-limit index 4.64 (Cpl) and the upper-limit index 3.51 (Cpu) show the warning "Chart out of control: Do not rely on this number" (no "Not reliable" line); the nearest-limit index 1.42 (Cpk) shows "Meets the minimum of 1.33". Tensile strength falls and porosity rises from build 21; the chart "Chamber oxygen: single value chart (I), parts per million" climbs steadily with red diamonds from B-1022. Builds B-1023 to B-1030 are QUARANTINE with the Investigate first cell "chamber oxygen (parts per million): 9.4 standard deviations above the center line" (at B-1023). Tick "Show only flagged builds" to see just those 8 rows.
- Screenshots: [`screenshots/oxygen_drift.png`](screenshots/oxygen_drift.png), phone width (375 px): [`screenshots/oxygen_drift_375px.png`](screenshots/oxygen_drift_375px.png)
- How to read this: the red UTS and porosity points start at B-1023 and the oxygen chart started drifting first, so check the chamber oxygen supply before the parts fail spec; the big index values do not count because the chart is out of control.

## 3. `marginal_spread` : in control, but not capable

- Page: choose **Marginal Spread** (`marginal_spread`) in the dropdown.
- API: `curl -s http://localhost:8000/analyze/marginal_spread`
- You see: "Process capable: NO", first out-of-control build **None**, all 30 builds RELEASE, no red point on any chart. Cpl 4.81 and Cpu 3.70 show "Meets the minimum of 1.33"; the dimensional Cpk 1.19 (Cp 1.20) shows "Below the minimum of 1.33: Not capable". The summary reads "No build broke a rule, but Dimensional deviation is below the minimum of 1.33, so the process is not shown to be capable."
- Screenshots: [`screenshots/marginal_spread.png`](screenshots/marginal_spread.png) (desktop), [`screenshots/marginal_spread_375px.png`](screenshots/marginal_spread_375px.png) (phone)
- How to read this: the process is stable, but the parts vary too much in size for the plus or minus 0.10 mm limit even when nothing drifts. Nothing to quarantine; reduce the build-to-build and coupon-to-coupon scatter of the dimension before relying on the process.

## Try your own file, other limits and a bad file

- **Upload:** in the page use *Upload dataset* and pick `data/oxygen_drift.csv`; the banner shows the same numbers as above (4.64, 3.51, 1.42, first B-1023). API: `curl -s -F file=@data/oxygen_drift.csv http://localhost:8000/analyze`
- **Other spec limits (any dataset or upload):** with `oxygen_drift` selected, edit *Tensile Strength: Lowest Allowed (MPa)* to 990 and press *Run again*; the lower-limit index (Cpl) becomes -1.04 (still marked not reliable). API: `curl -s "http://localhost:8000/analyze/oxygen_drift?uts_lsl=990"`, identical to `curl -s -F file=@data/oxygen_drift.csv "http://localhost:8000/analyze?uts_lsl=990"`. If *Dimensional Deviation: Lowest Allowed (mm)* is not below *Dimensional Deviation: Highest Allowed (mm)*, the page shows "Dimensional Deviation: Lowest Allowed (mm) must be below Dimensional Deviation: Highest Allowed (mm)." and sends nothing; the API answers 422.
- **Baseline builds:** set *Baseline builds* (in the *Control Charts* section) to 10 and press Enter (or *Update charts*); the limits use builds 1-10 (shaded on the charts) and the first out-of-control build becomes B-1022. The grey text under the box (in the *Control charts* section) says what it means ("How many of the earliest builds are used to learn what normal looks like ... Default: 20, minimum: 5.").
- **Your own data, minimal format:** click *How should my file be formatted?* under *Upload dataset* to open the *Spreadsheet file (CSV) format* popup (screenshot: [`screenshots/csv_help_panel.png`](screenshots/csv_help_panel.png)); it lists the 5 required columns with what each one means (units spelled out) and links *Download template*. Uploading `aeroprint_template.csv` (5 columns, 3 builds) shows the lower-limit index (Cpl) 3.88, no parameter charts, and  the note "No print-parameter columns in this file, so there are no parameter charts and the likely cause is not ranked." ([`screenshots/upload_minimal.png`](screenshots/upload_minimal.png)). `aeroprint_template_with_parameters.csv` adds the 8 parameter charts. Format guide: [`../docs/csv-format.md`](../docs/csv-format.md).
- **A friendly error:** upload a file where one build has 4 coupons; the page shows a plain-English hint ("Build B-0002 has 4 coupon rows, but every build needs exactly 5 ...") above the raw API message ([`screenshots/upload_error_friendly.png`](screenshots/upload_error_friendly.png)).
- **An infinite value:** upload a file where one tensile strength cell is `inf`; the page says "Column uts_MPa contains an endless value (inf, or a number too large to store). Replace it with the real measurement, or delete that row." above the service message ([`screenshots/upload_error_infinite.png`](screenshots/upload_error_infinite.png)). The page has a plain-words hint for the other upload messages too (True/False values, dates in a number column, a repeated column name, a file with a header but no rows).
- **Builds with the same timestamp:** upload a file in which every build has the same `build_timestamp`; open *Notes from the analysis* in the banner and read the note "3 builds share the same build_timestamp ... Give every build its own timestamp."
- **A bad file:** upload `README.md`; the page shows "The file could not be read as a spreadsheet file (CSV). Save it as a comma-separated UTF-8 file ..." in red, with the service message under it. Screenshot: [`screenshots/error_422.png`](screenshots/error_422.png)

Note on false alarms: eight run rules on many charts means an occasional chance alarm is expected.
Look for a build where several rules and several charts agree, as in the two problem datasets.

## Rebuild the screenshots

The screenshots were taken with Playwright for Node (not part of the app) against the built page:

```bash
# 1. API running (terminal 1 above)
# 2. build and serve the page
cd app/frontend && npm run build && npx vite preview --port 4173
# 3. in a scratch folder outside the repo: npm init -y && npm i playwright
#    then for each dataset: open http://localhost:4173, pick its API name (for example oxygen_drift) in #dataset,
#    page.screenshot({ path: 'demo/screenshots/<dataset>.png', fullPage: true })
#    (375 px: a page with viewport { width: 375, height: 800 })
#    The tour opens on a first visit: press Escape before each screenshot (tour_step1.png is taken before that).
```

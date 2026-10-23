# AeroPrint demo walkthrough

AeroPrint tells a supplier quality engineer whether the titanium-bracket print process is in
control and capable (Cpl for UTS, Cpu for porosity, Cpk for dimensional deviation, all against
1.33), from which build it stopped being in control, and what to do with each build (RELEASE,
RETEST or QUARANTINE). Every number below was copied from a real run of the API and the page.
The statistics live only in `app/qc.py`; the page only draws what the API returns.

## The three datasets at a glance

| Dataset (`data/`) | Process capable? | Cpl (UTS) | Cpu (porosity) | Cpk (dimensional) | First out-of-control build | Quarantined builds | Top suspect |
|---|---|---|---|---|---|---|---|
| `capable_baseline` | YES | 4.81 | 3.70 | 1.79 | none | none | none |
| `oxygen_drift` | NO | 4.64 (not reliable) | 3.51 (not reliable) | 1.42 (reliable) | B-1023 | B-1023 to B-1030 (8 builds) | chamber_oxygen_ppm (z = 9.4 at B-1023, 52.3 at B-1030) |
| `laser_power_excursion` | NO | 5.04 (not reliable) | 3.54 (not reliable) | 1.68 (not reliable) | B-1024 | B-1024, B-1025, B-1026 | laser_power_W (z = -37.0, -39.5, -37.5) |

"Not reliable" means the chart is out of control, so the index is printed but does not count.
No build in any of the three files is RETEST (no coupon was out of spec before the chart flagged it).
Limits come from the first 20 builds (B-1001 to B-1020).

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

Replace `oxygen_drift` with `capable_baseline` or `laser_power_excursion`.

## 1. `capable_baseline` : the good case

- Page: open http://localhost:5173, choose **capable_baseline** in the *Test dataset* dropdown (it is the default).
- API: `curl -s http://localhost:8000/analyze/capable_baseline` (command above).
- You see: banner "Process capable: YES", Cpl 4.81, Cpu 3.70, Cpk 1.79, all "reliable", "First out-of-control build: none". No red diamonds; all 30 builds are RELEASE.
- Screenshot: [`screenshots/capable_baseline.png`](screenshots/capable_baseline.png)
- How to read this: nothing is red and every index is above 1.33 while the charts are in control, so the process meets spec with margin.

## 2. `oxygen_drift` : a slow drift

- Page: choose **oxygen_drift** in the dropdown.
- API: `curl -s http://localhost:8000/analyze/oxygen_drift`
- You see: "Process capable: NO", first out-of-control build **B-1023**. Cpl 4.64 and Cpu 3.51 are marked "not reliable (chart out of control)"; Cpk 1.42 is reliable. UTS falls and porosity rises from build 21; the chamber oxygen I chart climbs steadily with red diamonds from B-1022. Builds B-1023 to B-1030 are QUARANTINE with "Investigate first: chamber_oxygen_ppm" (z = 9.4 at B-1023). Tick "Show only flagged builds" to see just those 8 rows.
- Screenshots: [`screenshots/oxygen_drift.png`](screenshots/oxygen_drift.png), phone width (375 px): [`screenshots/oxygen_drift_375px.png`](screenshots/oxygen_drift_375px.png)
- How to read this: the red UTS and porosity points start at B-1023 and the oxygen chart started drifting first, so check the chamber oxygen supply before the parts fail spec; the big index values do not count because the chart is out of control.

## 3. `laser_power_excursion` : a short sudden event

- Page: choose **laser_power_excursion** in the dropdown.
- API: `curl -s http://localhost:8000/analyze/laser_power_excursion`
- You see: "Process capable: NO", first out-of-control build **B-1024**. Cpl 5.04, Cpu 3.54, Cpk 1.68, all "not reliable". B-1024, B-1025 and B-1026 are QUARANTINE with "Investigate first: laser_power_W" (z = -37.0, -39.5, -37.5, the power dropped). The porosity X-bar chart jumps up for those three builds, then returns to normal.
- Screenshot: [`screenshots/laser_power_excursion.png`](screenshots/laser_power_excursion.png)
- How to read this: three red builds in a row line up with the laser power dropping, so those three builds are held and the laser is inspected; later builds look normal again.

## Try your own file, other limits and a bad file

- **Upload:** in the page choose *Use my own CSV* and pick `data/oxygen_drift.csv`; the banner shows the same numbers as above (Cpl 4.64, Cpu 3.51, Cpk 1.42, first B-1023). API: `curl -s -F file=@data/oxygen_drift.csv http://localhost:8000/analyze`
- **Other spec limits (uploads only):** after choosing a file, edit *UTS LSL* (for example 990) and press *Run again*; Cpl becomes -1.04. API: `curl -s -F file=@data/oxygen_drift.csv "http://localhost:8000/analyze?uts_lsl=990"`
- **Baseline builds:** set *Baseline builds* to 10 and press *Run again*; the limits use builds 1-10 (shaded on the charts) and the first out-of-control build becomes B-1022. The minimum is 5.
- **A bad file:** upload `README.md`; the page shows the API's message in red: "HTTP 422: could not read the upload as a CSV file: ...". Screenshot: [`screenshots/error_422.png`](screenshots/error_422.png)

Note on false alarms: eight run rules on many charts means an occasional chance alarm is expected.
Look for a build where several rules and several charts agree, as in the two problem datasets.

## Rebuild the screenshots

The screenshots were taken with Playwright for Node (not part of the app) against the built page:

```bash
# 1. API running (terminal 1 above)
# 2. build and serve the page
cd app/frontend && npm run build && npx vite preview --port 4173
# 3. in a scratch folder outside the repo: npm init -y && npm i playwright
#    then for each dataset: open http://localhost:4173, pick it in #dataset,
#    page.screenshot({ path: 'demo/screenshots/<dataset>.png', fullPage: true })
#    (375 px: a page with viewport { width: 375, height: 800 })
```

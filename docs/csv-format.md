# CSV format: how to prepare your own data

This guide is for an engineer who wants to upload fresh coupon data to AeroPrint.
You need a spreadsheet with **5 columns** and **5 rows per build**. That is all.
Everything else is optional.

- Dashboard: <https://connect.systems-apps.com/content/a5702adb-d4c3-4cbc-8856-737753cfd9d2/>
- API: <https://connect.systems-apps.com/content/8ec33f65-f84a-4323-a51d-b2d9a70e08da>
- Templates: [`aeroprint_template.csv`](../data/template/aeroprint_template.csv) (5 columns only) and
  [`aeroprint_template_with_parameters.csv`](../data/template/aeroprint_template_with_parameters.csv) (plus the 8 optional print parameters)

## 1-minute checklist

1. One row per coupon. Each build has **exactly 5 rows** with the same `build_id`.
2. These 5 columns exist, with exactly these names: `build_id`, `build_timestamp`, `uts_MPa`, `porosity_pct`, `dimensional_dev_mm`.
3. The three measurement columns hold plain numbers (no units, no `%`, no words) and no cell is empty.
4. `build_timestamp` looks like `2026-01-05T08:00:00`.
5. You have at least 2 builds (20 or more is much better, see "How many builds").
6. Upload it. Optional: add print-parameter columns (section 3) to find the likely cause of a problem.

## 2. Required columns

| Column | Type | Unit | Example | Where it comes from |
|---|---|---|---|---|
| `build_id` | text | none | `B-1007` | The build number or job name on the printer export. All 5 coupons of one build share it. |
| `build_timestamp` | date and time, ISO 8601 | none | `2026-01-05T08:00:00` | The build start (or end) time from the printer log. Any one consistent choice is fine. Builds are put in time order by this column. |
| `uts_MPa` | number | MPa | `948` | Ultimate tensile strength (UTS) of one witness coupon, from the tensile test report. |
| `porosity_pct` | number | % | `0.21` | Porosity of one coupon, from the density or CT report. Write `0.21` for 0.21 %. |
| `dimensional_dev_mm` | number | mm | `-0.012` | Measured size minus the drawing size of one coupon, from the CMM or caliper report. Can be negative. |

A *witness coupon* is a small test piece printed in the same build as the real brackets.
It is tested instead of the brackets.

## 3. Optional print-parameter columns

Add any of these to get an extra control chart per column and a ranked
"investigate first" hint for builds that go out of control. Leave out the ones you do not have.
The tool skips missing ones and says which it skipped.

| Column | Unit | What it tells you | Where it comes from |
|---|---|---|---|
| `laser_power_W` | W | Laser power. A drop can cause porosity (not enough melting). | Printer layer log, average per build |
| `scan_speed_mm_s` | mm/s | How fast the laser moves. | Printer layer log, average per build |
| `layer_thickness_um` | µm | Thickness of each powder layer. | Printer layer log, average per build |
| `chamber_oxygen_ppm` | ppm | Oxygen in the build chamber. Titanium picks up oxygen and becomes brittle. | Printer oxygen sensor, average per build |
| `humidity_pct` | % | Humidity in the chamber. | Printer sensor, average per build |
| `powder_bed_temp_C` | °C | Temperature of the powder bed. | Printer layer log, average per build |
| `build_plate_temp_C` | °C | Temperature of the build plate. | Printer layer log, average per build |
| `stress_relief_temp_C` | °C | Furnace temperature of the stress-relief heat treatment after printing. | Heat-treat furnace record |

**One value per build.** The best is the same value on all 5 rows of a build.
If the value changes between rows (for example you pasted raw layer-log values), the tool uses the
**mean of the rows of that build**.

A parameter that never changes in the first 20 builds cannot be charted (there is no spread to
measure). The tool skips it and tells you.

## 4. Extra columns are ignored

Keep `coupon_id`, `machine_id`, `material_lot`, `yield_MPa`, `elongation_pct`, `pass_fail`, notes,
or anything else if it is useful to you. The tool never reads them. A blank cell or text in an
extra column causes no error. (The four sample files in `data/` contain such columns; that is why
they have 19 columns.)

## 5. Formatting rules

- **Header names exactly as above.** Capital letters and underscores matter: `uts_MPa`, not `UTS` or `uts_mpa`.
- **UTF-8 CSV with a header row**, comma separated. In Excel: *Save As*, then *CSV UTF-8 (Comma delimited)*.
- **Decimal point**, not a decimal comma: `0.21`.
- **Numbers only** in number cells: `948`, not `948 MPa`; `0.21`, not `0.21 %`.
- **Timestamps** in ISO 8601 form: `2026-01-05T08:00:00` (year-month-day, `T`, hours:minutes:seconds). A plain date `2026-01-05` also works.
- **Write dates year first.** Use year-month-day (`2026-01-05T08:00:00`). A day/month date such as `01/02/2026` is read month first (January 2), so it can be wrong without any error message. Use the ISO form to be safe.
- **Give every build its own timestamp.** If two builds share a timestamp, the tool still runs but orders them by their position in the file (see the warning in section 10).
- **No blank cells** in the 5 required columns or in any optional parameter column you include.
- **Exactly 5 coupons per build.**
- **Any row order.** Builds are sorted by `build_timestamp`; the earliest timestamp of a build places it.

### Worked example: 2 builds, 5 columns

```csv
build_id,build_timestamp,uts_MPa,porosity_pct,dimensional_dev_mm
B-0001,2026-01-05T08:00:00,945,0.19,0.012
B-0001,2026-01-05T08:00:00,952,0.22,-0.008
B-0001,2026-01-05T08:00:00,950,0.20,0.021
B-0001,2026-01-05T08:00:00,948,0.23,-0.015
B-0001,2026-01-05T08:00:00,955,0.18,0.003
B-0002,2026-01-07T08:00:00,951,0.21,-0.020
B-0002,2026-01-07T08:00:00,953,0.19,0.010
B-0002,2026-01-07T08:00:00,955,0.24,0.004
B-0002,2026-01-07T08:00:00,957,0.20,0.025
B-0002,2026-01-07T08:00:00,959,0.22,-0.011
```

Ten rows, two builds, five rows each. (Two builds are enough to run, but not enough to trust: see below.)

## 6. How to upload

**Dashboard.** Open the dashboard, choose *Use my own CSV* and pick your file. Open the
*CSV format* panel under the upload box for a reminder and the template downloads.
You can change the spec limits in the boxes and press *Run again*.

**curl** (the live API):

```text
curl -F file=@yourfile.csv https://connect.systems-apps.com/content/8ec33f65-f84a-4323-a51d-b2d9a70e08da/analyze
```

Add spec limits or the baseline size as query parameters, for example
`.../analyze?uts_lsl=920&baseline_n=20`.

**Python** (run from the repo root, after `pip install -r requirements.txt`):

```python
import pandas as pd
from app.qc import analyze

result = analyze(pd.read_csv("yourfile.csv"))
print(result["process_capable"], result["capability"]["uts_MPa"]["cpl"])
```

## 7. How many builds do you need?

- **At least 2 builds.** With fewer the tool refuses to draw a chart.
- **20 builds is the default baseline.** The control limits are computed from the first 20 builds
  (in time order), which should be a period when the process behaved normally.
- **Fewer than 20 builds:** all builds form the baseline, and the tool says so in its notes.
  The limits are then less reliable, and a problem inside those builds cannot show up as a flag
  against a clean baseline. The template in section 9 uses 3 builds only to check the arithmetic.
- You can change the baseline size (minimum 5) in the dashboard or with `baseline_n`.

## 8. How to change the spec limits

The defaults are UTS lower limit 900 MPa, porosity upper limit 0.5 %, dimensional deviation
-0.10 to +0.10 mm. Change them in the four boxes on the dashboard and press *Run again*, or add
`uts_lsl`, `porosity_usl`, `dim_lsl`, `dim_usl` to the API URL, or pass
`specs={"uts_MPa": {"lsl": 920}}` to `analyze()`.

## 9. Does everything check out?

First test the tool, then your data.

1. Upload `aeroprint_template.csv` (5 columns, 3 builds). The dashboard banner must show
   **Cpl (UTS) 3.88** (the API gives 3.877). This is the hand-calculated answer in
   [`SPEC.md`](../SPEC.md) section 4: X-bar-bar 950.0, X-bar limits 944.23 to 955.77, R chart UCL 21.14.
   The template has only 3 builds, so the tool will note that all 3 form the baseline.
2. Upload `aeroprint_template_with_parameters.csv`. Same quality numbers, plus 8 parameter charts.
3. Now upload your own file.

## 10. Common errors

The dashboard shows a plain-English hint above the exact message from the API (HTTP 422).
These are the exact messages (bold parts change with your file).

| Message | What it means | Fix |
|---|---|---|
| `missing required columns: uts_MPa` | A required column is not in the header (or is spelled differently). | Add it, or rename your column to the exact name. |
| `build B-0002 has 4 coupons; each build needs exactly 5 coupons` | That build has 4 rows, not 5. | Add the missing coupon row, or remove the incomplete build. Rows with a wrong or typo'd `build_id` also cause this. |
| `column 'uts_MPa' has non-numeric text, for example '950 MPa' in row 4 of the file; use plain numbers without units` | A number cell contains words or units. Row 1 is the header. | Replace it with the plain number `950`. |
| `column 'porosity_pct' has 1 blank or missing values (first in row 4 of the file); fill them in or delete those rows` | An empty cell in a column the tool uses. | Fill it in, or delete that coupon and its build's other rows. |
| `build_timestamp is not a valid date/time (for example 'last Tuesday'); use a form like 2026-01-05T08:00:00` | A timestamp cannot be read. | Use `2026-01-05T08:00:00`. |
| `need at least 2 builds to draw a control chart` | Only one build in the file. | Add more builds. |
| `column 'uts_MPa' has an infinite value (row 7 of the file); use ordinary numbers` | A number cell holds `inf`, `-inf` or a number too large to store (such as `1e400`). | Replace it with the real measurement. |
| `column 'uts_MPa' contains True/False values; it must contain numbers` | A number column holds `True` or `False` (for example a pass/fail column was put in the wrong place). | Put the measured numbers in that column. Keep pass/fail in an extra column, which is ignored. |
| `column 'uts_MPa' contains dates or times; it must contain numbers` | A number column holds dates or times. | Put the measured numbers in that column. |
| `column 'uts_MPa' appears 2 times in the header; keep only one` | The same column name is in the header twice. | Delete or rename one of them. |
| `the file has a header but no data rows` | The file has only the header line. | Add the coupon rows below it. |
| `could not read the upload as a CSV file: ...` | The file is empty, binary, or not a CSV. | Save it again as *CSV UTF-8* with a header row. |

Warnings (not errors) appear in the dashboard's *Notes from the analysis*. Three you may see:
`No print-parameter columns found: the "investigate first" ranking is skipped.` and
`Print-parameter columns not found (skipped): ...`. They only tell you which optional columns were absent. The third is
`2 builds share the same build_timestamp (for example B-0001 and B-0002); builds with the same timestamp are ordered by their position in the file, which changes which builds form the baseline. Give every build its own timestamp.`
The numbers are still calculated, but which builds count as the baseline depends on the row order in your file. Give each build its own timestamp to remove the warning.

## 11. What the results mean, in 3 lines

1. **Process capable: YES** means every chart is in control and every index (Cpl, Cpu, Cpk) is at least 1.33.
2. **A red point** means that build behaved differently from the baseline builds; the table gives
   RELEASE, RETEST or QUARANTINE and, if you included print parameters, which one to investigate first.
3. An index only counts while its chart is in control; otherwise it is marked "not reliable".

The full method, the formulas and the sample-data walkthrough are in the project [`README.md`](../README.md).

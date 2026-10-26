# AeroPrint test datasets and codebook

**All data in this folder are invented (simulated). They are not real aerospace or customer data.**
They are shaped like the records a titanium (Ti-6Al-4V) laser powder-bed-fusion shop would keep:
30 builds, 5 witness coupons per build, one row per coupon.

A witness coupon is a small test piece printed on the same plate as the real brackets. It is tested
instead of the brackets, so the brackets can ship.

## Contents

1. [The three datasets and the story each tells](#1-the-three-datasets-and-the-story-each-tells)
2. [File-level facts](#2-file-level-facts)
3. [Codebook: all 19 columns](#3-codebook-all-19-columns)
4. [Specification limits](#4-specification-limits)
5. [How the data were simulated](#5-how-the-data-were-simulated)
6. [Expected results (baseline 20, default limits)](#6-expected-results-baseline-20-default-limits)
7. [Templates for your own data](#7-templates-for-your-own-data)
8. [How to use these files](#8-how-to-use-these-files)
9. [Background: how this data would be collected for real](#9-background-how-this-data-would-be-collected-for-real)

Related: the project front page [`../README.md`](../README.md), the upload format guide
[`../docs/csv-format.md`](../docs/csv-format.md), the demonstration walkthrough
[`../demo/README.md`](../demo/README.md), the generator script [`generate.py`](generate.py).

## 1. The three datasets and the story each tells

| File | Story |
|---|---|
| `capable_baseline.csv` | A stable, capable process. Nothing drifts. Every build is in control and every capability index is above the minimum of 1.33. All 30 builds are RELEASE. |
| `oxygen_drift.csv` | A slow drift. The chamber oxygen creeps up from build 21 (B-1021) from about 100 ppm to about 430 ppm (the highest build average in the file is 421.9 ppm). Tensile strength falls and porosity rises. The first alarm is at B-1023, on the tensile strength build average chart (X-bar), rules 1 and 5. Builds B-1023 to B-1030 are QUARANTINE (a rule was broken). The other 22 builds are NOT RELEASED, because the process as a whole is not capable. |
| `marginal_spread.csv` | In control, but not capable. Tensile strength, porosity and all eight print parameters are identical to `capable_baseline.csv` (same random numbers). The dimensional deviation is different in two ways. First, its spread inside a build is larger: standard deviation (sd) 0.030 mm instead of 0.020 mm. Second, it has a **planted machine effect** (see below). No chart raises an alarm, but the dimensional capability index is low: Cpk 1.04, below 1.33. The process is not capable, so **no build is released: all 30 builds are NOT RELEASED**. |

**The planted machine effect (disclosed).** In `marginal_spread.csv` only, every dimensional
coupon of every build printed on machine AM-02 has +0.025 mm added to its dimensional deviation.
It is there so the "Possible Causes" analysis has something real to find. The size was chosen
after a scan, at seed 5336. A shift of 0.015 mm gave a machine p-value of 0.135 (too small to detect),
0.020 mm gave 0.017, 0.025 mm gave 0.0015 with no control chart alarm, and 0.030 mm raised an alarm.
We kept 0.025 mm, large enough to detect and small enough to raise no alarm. The seed is unchanged.
In `capable_baseline.csv` and `oxygen_drift.csv` there is no machine effect.

## 2. File-level facts

| Fact | Value (the same in all three files unless stated) |
|---|---|
| Rows | 150 (plus 1 header row) |
| Builds | 30, `B-1001` to `B-1030` |
| Coupons per build | 5 (the tool needs exactly 5) |
| Coupon ids | `C-<build number>-01` to `C-<build number>-05`, for example `C-1001-01` |
| Timestamps | ISO 8601 text such as `2026-01-05T08:00:00`. Naive local time (no time zone). Every build runs at 08:00, one build every 2 days, from 2026-01-05 (B-1001) to 2026-03-04 (B-1030). The 5 coupons of a build share one timestamp. |
| Machines | `AM-01` for builds 1-5, 11-15 and 21-25; `AM-02` for builds 6-10, 16-20 and 26-30 (alternating blocks of 5 builds) |
| Powder lots | `Ti64-Lot-21` for builds 1-10, `Ti64-Lot-22` for builds 11-20, `Ti64-Lot-23` for builds 21-30 |
| Machine and lot together | A balanced 2 x 3 layout: each of the 6 machine and lot combinations has exactly 5 builds |
| Confounding | Machine and lot are **mixed up with time** (the machine changes in blocks of 5 builds and the lot in blocks of 10, in date order, nothing was randomised). A difference between machines could be a time effect. |
| Missing values | None (checked: 0 empty cells in each file) |
| Columns | 19, in the order of the codebook below |
| Format | Comma separated, one header row, no index column, no quoting, ASCII text (so also valid UTF-8), LF (`\n`) line endings, `True` and `False` for the pass_fail column |
| Decimal places | `uts_MPa` and `yield_MPa` 1; `elongation_pct` 2; `porosity_pct` and `dimensional_dev_mm` 3; `layer_thickness_um` 2; all other parameters 1 |

## 3. Codebook: all 19 columns

How to read the "role" column:

- **Required**: the tool cannot run without it.
- **Optional parameter**: a print setting. If it is present the tool draws a chart for it and
  ranks it in the "Investigate first" column. If it is absent it is skipped.
- **Optional factor**: used only for the "Possible Causes by Machine and Material Lot" section.
  If absent, the section shows a note.
- **Ignored extra**: never read by the tool. It is there because a real lab export has it, so a
  blank or text in it cannot cause an error.

The ranges are the smallest and largest value in each file (capable_baseline / oxygen_drift / marginal_spread).
Where the three are the same, one range is shown.

| # | Column | Type | Unit | Meaning in plain words | How a real shop measures or records it | Observed range | Role in the tool |
|---|---|---|---|---|---|---|---|
| 1 | `build_id` | text | none | Name of the build. The 5 rows with the same name form one group. | Build number from the build record | `B-1001` to `B-1030` | Required |
| 2 | `coupon_id` | text | none | Name of one witness coupon | Label on the coupon, from the test lab | `C-1001-01` to `C-1030-05` | Ignored extra |
| 3 | `build_timestamp` | ISO 8601 time | none | When the build ran. Sets the time order of the builds. | Build record start time | 2026-01-05T08:00:00 to 2026-03-04T08:00:00 | Required |
| 4 | `machine_id` | text | none | Which printer made the build | Build record | `AM-01`, `AM-02` | Optional factor |
| 5 | `material_lot` | text | none | Which batch of titanium powder was used | Powder lot record | `Ti64-Lot-21`, `-22`, `-23` | Optional factor |
| 6 | `uts_MPa` | number | MPa | Ultimate tensile strength of the coupon: the highest stress it carried before breaking. Higher is better. | Tensile test on a tensile frame; the lab reports it | 960.4 to 988.8 / 930.7 to 985.4 / 960.4 to 988.8 | Required |
| 7 | `yield_MPa` | number | MPa | Yield strength: the stress at which the coupon starts to deform for good | Same tensile test | 862.4 to 892.9 / 833.7 to 891.9 / 862.4 to 892.9 | Ignored extra |
| 8 | `elongation_pct` | number | % | How much the coupon stretched before it broke, as a share of its original length | Same tensile test | 8.96 to 11.00 / 8.02 to 10.82 / 8.96 to 11.00 | Ignored extra |
| 9 | `porosity_pct` | number | % | Share of the coupon volume that is empty voids. Lower is better. | Cross-section under a microscope, or a CT scan, of the coupon | 0.148 to 0.300 / 0.130 to 0.531 / 0.148 to 0.300 | Required |
| 10 | `dimensional_dev_mm` | number | mm | Measured size minus the drawing size. 0 is perfect; negative is too small, positive is too big. | Coordinate measuring machine (CMM) or caliper, compared with the drawing | -0.057 to 0.036 / -0.061 to 0.052 / -0.061 to 0.079 | Required |
| 11 | `pass_fail` | True / False | none | A convenience flag written by `generate.py`: `True` only if `uts_MPa` is at least 900, `porosity_pct` is at most 0.5 and the absolute value of `dimensional_dev_mm` is at most 0.10; otherwise `False`. | A lab report often has a pass or fail column | All True / 149 True and 1 False (B-1030: tensile strength 930.7 MPa is fine, porosity 0.531 % is above 0.5 %) / All True | Ignored extra. **The tool does not use it**; it decides from the control charts and capability indices instead. |
| 12 | `laser_power_W` | number | W | Mean laser power over the build (nominal 280 W) | Printer layer log, averaged over all layers | 277.1 to 282.7 / 277.2 to 282.9 / 277.1 to 282.7 | Optional parameter |
| 13 | `scan_speed_mm_s` | number | mm/s | Mean speed of the laser along the scan path (nominal 1200 mm/s) | Printer layer log, averaged | 1189.4 to 1209.6 / 1193.4 to 1208.3 / 1189.4 to 1209.6 | Optional parameter |
| 14 | `layer_thickness_um` | number | µm | Mean thickness of one powder layer (nominal 30 µm) | Printer setting or layer log | 29.40 to 30.61 / 29.29 to 30.64 / 29.40 to 30.61 | Optional parameter |
| 15 | `chamber_oxygen_ppm` | number | ppm (parts per million) | Mean oxygen in the build chamber (nominal about 100 ppm). Oxygen makes titanium brittle. | Oxygen sensor in the chamber, averaged | 81.8 to 113.2 / 92.4 to 421.9 / 81.8 to 113.2 | Optional parameter |
| 16 | `humidity_pct` | number | % | Mean relative humidity in the chamber (nominal about 35 %) | Humidity sensor, averaged | 30.6 to 38.0 / 31.3 to 39.5 / 30.6 to 38.0 | Optional parameter |
| 17 | `powder_bed_temp_C` | number | °C | Mean temperature of the powder bed (nominal about 180 °C) | Printer sensor, averaged | 177.6 to 183.8 / 177.5 to 183.9 / 177.6 to 183.8 | Optional parameter |
| 18 | `build_plate_temp_C` | number | °C | Mean temperature of the build plate (nominal about 200 °C) | Printer sensor, averaged | 196.8 to 203.1 / 197.1 to 203.0 / 196.8 to 203.1 | Optional parameter |
| 19 | `stress_relief_temp_C` | number | °C | Furnace temperature of the heat treatment after the build that relaxes built-in stress (nominal about 650 °C) | Furnace record, once per furnace load | 641.5 to 655.3 / 643.2 to 655.3 / 641.5 to 655.3 | Optional parameter |

Columns 12 to 19 hold the same value on all 5 rows of a build (one value per build).
In the codebook table, "Optional parameter" columns can also be raw values: the tool averages them per build.

Note on the three quality columns: the tool analyses `uts_MPa`, `porosity_pct` and
`dimensional_dev_mm` as the three measurements. Their specification limits are in the next section.

## 4. Specification limits

| Measurement | Limit | Target |
|---|---|---|
| Tensile strength (`uts_MPa`) | Lowest allowed 900 MPa | 950 MPa |
| Porosity (`porosity_pct`) | Highest allowed 0.5 % | 0.2 % |
| Dimensional deviation (`dimensional_dev_mm`) | -0.10 mm to +0.10 mm | 0 mm |

**These limits are assumptions entered in the dashboard (Test Parameters box), not measured values
and not taken from a real purchase specification.** A real client's drawing sets the real limits.
They can be changed in the dashboard or with query parameters in the API.

## 5. How the data were simulated

The script [`generate.py`](generate.py) (numpy and pandas only) does this for each file:

1. **Build parameters, drawn once per build** (normal distributions: mean, standard deviation):
   laser power 280 W, sd 1.5; scan speed 1200 mm/s, sd 5; layer thickness 30 µm, sd 0.3; chamber oxygen 100 ppm, sd 8;
   humidity 35 %, sd 2; powder bed temperature 180 °C, sd 1.5; build plate temperature 200 °C, sd 1.5;
   stress-relief temperature 650 °C, sd 3.
2. **`oxygen_drift` only:** for builds 21 to 30 the oxygen is replaced by 100 ppm + 330 ppm x (a ramp from 0 to 1 over the 10 builds) + noise with sd 8 ppm.
3. **Coupon results**: a small linear effect of the parameters plus independent noise for every coupon.
   The effects only act in the bad direction ("excess oxygen" is oxygen above 100 ppm; "power shortfall" is laser power below 280 W).
   - Tensile strength = 975 MPa + a build effect (sd 1 MPa) - 0.12 MPa x excess oxygen (per ppm) - 0.8 MPa x power shortfall (per W) + coupon noise (sd 5 MPa).
   - Yield strength = 0.9 x tensile strength + noise (sd 4 MPa).
   - Elongation = 10 % - 0.004 % x excess oxygen (per ppm) + noise (sd 0.4 %).
   - Porosity = (0.20 % + 0.0007 % x excess oxygen (per ppm) + 0.006 % x power shortfall (per W)) x a lognormal factor (log sd 0.125), so porosity is skewed and always above 0.
   - Dimensional deviation = normal noise with mean 0 and sd 0.020 mm (0.030 mm for `marginal_spread`), plus 0.025 mm on machine AM-02 in `marginal_spread` only.
   - `pass_fail` is then worked out from the rounded values.
4. **Machine and lot** are set from the build number: machine changes every 5 builds, lot every 10.

**Seeds** (numpy `default_rng`, one random stream per file): `capable_baseline` 5336, `oxygen_drift` 5322,
`marginal_spread` 5336 (the base seed 5300 plus 36, 22 and 36). `marginal_spread` uses the same seed as
`capable_baseline`, so it draws the same random numbers; only its dimensional column differs.

**How the seeds were chosen, honestly.** For each file we tried seeds 5300, 5301, 5302, ... and kept the first
seed whose builds 1 to 20 raised no alarm under the tool's 8 run rules (on the tensile strength, porosity and
dimensional charts and on all eight print-parameter charts) and whose planted story then played out as designed. So the clean baselines
are clean **by selection**. Real data checked against 8 rules on many charts WILL sometimes raise a chance alarm. That is
why the tool lists the rules broken per build for an engineer to judge, instead of treating a flag as proof.
You can see this yourself: with a baseline of only 6 builds, `capable_baseline` raises a first alarm at B-1006.

**Regenerate** (from the repo root; the CSVs come out byte for byte the same):

    .venv/Scripts/python.exe data/generate.py

On macOS or Linux use `.venv/bin/python data/generate.py`.

## 6. Expected results (baseline 20, default limits)

Taken from the running analysis service (`GET /analyze/<name>`) with the default baseline of 20 builds
(B-1001 to B-1020) and the default limits of section 4. "Not reliable" means the chart is out of control, so the index is
printed but does not count. The minimum for a capable process is 1.33.

| Result | `capable_baseline` | `oxygen_drift` | `marginal_spread` |
|---|---|---|---|
| Process capable? | Yes | No | No |
| Tensile strength Cpl (lowest allowed 900 MPa) | 4.81 | 4.64 (not reliable) | 4.81 |
| Porosity Cpu (highest allowed 0.5 %) | 3.70 | 3.51 (not reliable) | 3.70 |
| Dimensional deviation Cpk | 1.79 | 1.42 | **1.04** (below 1.33) |
| Dimensional deviation Cp / Cpl / Cpu | 1.80 / 1.81 / 1.79 | 1.45 / 1.42 / 1.48 | 1.20 / 1.36 / 1.04 |
| Dimensional process average and sigma-hat | 0.0004 mm, 0.0185 mm | -0.0021 mm, 0.0230 mm | 0.0131 mm, 0.0278 mm |
| First out-of-control build | none | B-1023 (tensile strength X-bar, rules 1 and 5) | none |
| Builds QUARANTINE | 0 | 8 (B-1023 to B-1030) | 0 |
| Builds NOT RELEASED | 0 | 22 (B-1001 to B-1022) | 30 |
| Builds RELEASE | 30 | 0 | 0 |
| Dimensional ANOVA, machine p-value | 0.154 | 0.102 | **0.0015** (F 12.77) |
| Dimensional ANOVA, material lot p-value | 0.878 | 0.108 | 0.88 |
| Dimensional ANOVA, machine x lot interaction p-value | 0.932 | not tested (no AM-02 builds in lot 23 once the 8 quarantined builds are left out) | 0.92 |
| Dimensional machine averages (build averages) | AM-01 0.0024 mm, AM-02 -0.0024 mm | AM-01 -0.0036 mm, AM-02 0.0013 mm | AM-01 0.0037 mm, AM-02 0.0214 mm |
| Builds used by the machine and lot analysis | 30 | 22 (8 quarantined builds left out) | 30 |

Other facts from the same runs:

- `oxygen_drift`: chamber oxygen is the first suspect for every quarantined build ("Investigate first"); for B-1023 it is 9.4 standard deviations above the center line, for B-1030 it is 52.3.
- `marginal_spread`: the tensile strength and porosity machine and lot tests find nothing (all p-values above 0.05), and only the dimensional machine effect is found.
- The dimensional deviation in `capable_baseline` is flagged as slightly non-normal (Shapiro-Wilk test p-value 0.0073), so its indices are approximate. Porosity indices carry a standing note that they are approximate, because porosity is skewed.
- With a baseline of 10 builds instead of 20, `oxygen_drift` has its first alarm at B-1022 (porosity range chart).

## 7. Templates for your own data

They live in [`template/`](template/), apart from the three datasets.

| File | What it is |
|---|---|
| [`template/aeroprint_template.csv`](template/aeroprint_template.csv) | The 5 required columns only, 3 builds (15 rows). The values are the hand-calculation example from `SPEC.md` section 4 (invented). |
| [`template/aeroprint_template_with_parameters.csv`](template/aeroprint_template_with_parameters.csv) | The same 15 rows plus the 8 optional print-parameter columns (13 columns). |

**Known-answer check.** Upload `aeroprint_template.csv`. The tool reports a tensile strength Cpl of **3.877**
(process average 950.0 MPa, average range 10.0 MPa, sigma-hat 4.299 MPa, lowest allowed 900 MPa), the same number as the hand
calculation (50 / (3 x 4.299) = 3.877). This was checked by running the file through the service.
Because there are only 3 builds, the tool also shows a note that the limits are rough. See
[`../docs/csv-format.md`](../docs/csv-format.md) for the full upload rules.

## 8. How to use these files

**In the dashboard.** Open the page, choose the dataset in the "Select an example dataset" drop-down
(Capable Baseline, Oxygen Drift or Marginal Spread), or use "Upload dataset" to pick any CSV file.

**With the API** (start it from the repo root with `bash app/testme.sh`; it listens on port 8000):

    curl -s http://localhost:8000/analyze/oxygen_drift
    curl -s -F file=@data/oxygen_drift.csv http://localhost:8000/analyze

The second command is `POST /analyze` with the file. Both return the same numbers.

**In Python** (from the repo root):

    import pandas as pd
    from app.qc import analyze
    result = analyze(pd.read_csv("data/oxygen_drift.csv"))
    print(result["process_capable"], result["first_out_of_control_build"])

## 9. Background: how this data would be collected for real

This section is general background, not a standard. It is context for the invented data above.

| What | How it is collected |
|---|---|
| Tensile strength, yield, elongation | Each build plate carries 5 witness coupons. They are machined and pulled apart on a tensile frame. Tensile testing of metals is commonly done to a published standard such as ASTM E8/E8M (context only). The lab exports the results. |
| Porosity | A cross-section is polished and looked at under a microscope, or the coupon is scanned (CT). The same 5 coupons are used. |
| Dimensional deviation | Each coupon is measured with a CMM or caliper and compared with the drawing. Record the measured size minus the drawing size, in mm. |
| Print parameters | The printer logs laser power, scan speed, layer thickness, oxygen, humidity and temperatures layer by layer. Average each over the whole build to get one value per build. |
| Stress-relief temperature | Taken from the furnace record of the load the build was in. |
| Machine and powder lot | Taken from the build record. "Ti64" in the lot names stands for the titanium alloy Ti-6Al-4V (context only). |

Points to plan for:

- **One build is one group of 5 coupons.** The 5 coupons of a build were printed together, so their differences show the scatter inside a build,
  and the differences between build averages show shifts from build to build. That is why the tool uses groups of 5.
- **Sample size.** The tool needs at least 3 builds and warns below 10 builds. Its guide is at least 10 builds, and 20 or more is best, because the control limits are learned
  from the early builds and are rough with few.
- **Order and timing.** Record the true start time of each build and list the builds in time order. The tool sorts by `build_timestamp`.
  Give every build its own timestamp.
- **Avoid mixing up causes.** If you can, assign machines and powder lots to builds at random (or at least mix them in time).
  If a machine is always used in the same weeks, or a lot always in the same months, a difference cannot be told apart from a change over time.
  The datasets here are not randomised, which is why the tool calls its machine and lot result an association, not a cause.
- **Units.** Record every value in the units of the codebook (MPa, %, mm, W, mm/s, µm, ppm, °C) and keep one unit per column.

# Test datasets and codebook (AeroPrint)

**All data here is simulated (invented). It is not real customer or aerospace data.**
It is shaped like the field data a titanium (Ti-6Al-4V) laser powder-bed-fusion shop would
have: 30 builds, 5 witness coupons per build, one row per coupon (150 rows per file).

## The files

| File | Scenario it shows |
|---|---|
| `capable_baseline.csv` | Stable process, all 30 builds in control. Should be reported capable (Cpl and Cpu well above 1.33). |
| `oxygen_drift.csv` | Chamber oxygen creeps up linearly from build 21 (about 100 to 430 ppm). UTS falls and porosity rises; in the tool's output the first out-of-control build is B-1023, and "investigate first" lists chamber oxygen on top for every flagged build. |
| `marginal_spread.csv` | Same process as `capable_baseline.csv` (same random stream, so tensile strength, porosity and every print parameter are identical) but the dimensional deviation varies more (within-build sd 0.030 mm instead of 0.020 mm). Every build is in control on every chart, yet the dimensional index Cpk is about 1.19, below the minimum of 1.33. Shows "in control but not capable": process capable = no, no flagged build, all 30 builds RELEASE. |
| `laser_power_excursion.csv` | Laser power drops about 15 % (to about 238 W) on builds 24, 25 and 26 only. Porosity spikes above its upper limit and UTS dips on those builds (rule 1), then recovers. The first out-of-control build is B-1024 and "investigate first" puts laser power on top for builds 1024-1026. |

## Columns (19 in the sample files, in this order)

**The tool needs only 5 of these 19.** Required: `build_id`, `build_timestamp`, `uts_MPa`,
`porosity_pct`, `dimensional_dev_mm`. Optional: the 8 build-level print parameters below. The other
six columns (`coupon_id`, `machine_id`, `material_lot`, `yield_MPa`, `elongation_pct`, `pass_fail`)
are **not used by the tool; kept as realistic extras** (a real lab export has them). Templates with
only the needed columns, and the upload rules, are in [`template/`](template/) and
[`../docs/csv-format.md`](../docs/csv-format.md).

Coupon-level columns (differ per row):

| Column | Type | Unit | Meaning |
|---|---|---|---|
| `build_id` | text | - | Build number, `B-1001` to `B-1030`. Defines the subgroup of 5 coupons. |
| `coupon_id` | text | - | Witness coupon, `C-<build number>-01` to `-05`. *Not used by the tool; kept as a realistic extra.* |
| `build_timestamp` | ISO 8601 datetime | - | When the build ran; one build every 2 days from 2026-01-05. Used for time order. |
| `machine_id` | text | - | Printer, `AM-01` or `AM-02` (alternating blocks of 5 builds). *Not used by the tool; kept as a realistic extra.* |
| `material_lot` | text | - | Powder lot, `Ti64-Lot-21`, `-22`, `-23` (changes every 10 builds). *Not used by the tool; kept as a realistic extra.* |
| `uts_MPa` | number | MPa | Ultimate tensile strength from the tensile test. Spec: at least 900 (target 950). |
| `yield_MPa` | number | MPa | Yield strength from the same tensile test. *Not used by the tool; kept as a realistic extra.* |
| `elongation_pct` | number | % | Elongation at break from the same tensile test. *Not used by the tool; kept as a realistic extra.* |
| `porosity_pct` | number | % | Porosity (void fraction) of the coupon. Spec: at most 0.5 (target 0.2). |
| `dimensional_dev_mm` | number | mm | Measured dimension minus drawing dimension. Spec: within +/-0.10 (target 0). |
| `pass_fail` | True/False | - | True only if UTS >= 900, porosity <= 0.5 and abs(dimensional_dev) <= 0.10. *Not used by the tool; kept as a realistic extra.* |

Build-level columns (the same value on all 5 rows of a build). The tool treats these 8 as **optional**:

| Column | Type | Unit | Meaning |
|---|---|---|---|
| `laser_power_W` | number | W | Mean laser power over the build (nominal 280). |
| `scan_speed_mm_s` | number | mm/s | Mean scan speed (nominal 1200). |
| `layer_thickness_um` | number | um | Mean layer thickness (nominal 30). |
| `chamber_oxygen_ppm` | number | ppm | Mean oxygen in the build chamber (nominal about 100). |
| `humidity_pct` | number | % | Mean relative humidity in the chamber (nominal about 35). |
| `powder_bed_temp_C` | number | deg C | Mean powder bed temperature (nominal about 180). |
| `build_plate_temp_C` | number | deg C | Mean build plate temperature (nominal about 200). |
| `stress_relief_temp_C` | number | deg C | Furnace temperature of the stress-relief heat treatment after the build (nominal about 650). |

## Templates for your own data

[`template/aeroprint_template.csv`](template/aeroprint_template.csv) has only the 5 required columns and
the 3 builds (15 rows) of the hand calculation in `SPEC.md` section 4; its UTS Cpl is 3.877.
[`template/aeroprint_template_with_parameters.csv`](template/aeroprint_template_with_parameters.csv) adds
the 8 optional parameter columns. The values are invented. They live in `template/` (not next to the
four sample files) so the "4 sample datasets" count stays true. Guide: [`../docs/csv-format.md`](../docs/csv-format.md).

## Spec limits used

| Characteristic | Limit | Target |
|---|---|---|
| UTS | LSL 900 MPa | 950 MPa |
| Porosity | USL 0.5 % | 0.2 % |
| Dimensional deviation | +/-0.10 mm | 0 mm |

## How the data was made

`data/generate.py` (numpy and pandas only) draws each build's parameters, then each coupon's
results from a small linear effect of those parameters plus independent noise per coupon.
Within-build UTS sd is about 5 MPa; porosity is lognormal so it stays above 0. Effects used
(per unit in the bad direction): UTS falls 0.12 MPa per ppm oxygen above 100 and 0.8 MPa per W
below 280; porosity rises 0.0007 % per ppm above 100 and 0.006 % per W below 280.

**Regenerate** (from the repo root; same files every time, checked by md5 on two runs):

    .venv/Scripts/python.exe data/generate.py

**Seeds** (numpy `default_rng`, one stream per file): `capable_baseline.csv` 5336,
`oxygen_drift.csv` 5322, `laser_power_excursion.csv` 5318, `marginal_spread.csv` 5336 (base seed 5300 + k).
**How the seeds were chosen, honestly:** for each file we tried 5300, 5301, 5302, ... and kept the
first seed whose builds 1-20 raised no alarm under the tool's 8 Nelson rules (on the UTS,
porosity and dimensional charts and on all build-parameter I-MR charts) and whose planted story
then played out as designed. So the clean baselines are clean by selection. **Real data with all
8 rules WILL sometimes raise chance alarms** (a false alarm every so often is expected from
noise alone), which is why the tool lists the rules broken per build for an engineer to judge
rather than treating a flag as proof.

**How `marginal_spread.csv` was chosen, honestly:** the recipe is the `capable_baseline` generator with only the dimensional noise sd changed (0.030 mm). `numpy` draws the same random numbers whatever the sd, so only the dimensional column is rescaled. We scanned k = 0, 1, 2, ... and kept the first seed (k = 36, 5336, which is also the seed of `capable_baseline`) where all 30 builds raise no alarm on any quality chart or parameter chart. Seeds 5300 to 5335 each had at least one chance alarm somewhere (for example k = 4 was clean on the quality charts but not on every parameter chart). `capable_baseline.csv`, `oxygen_drift.csv` and `laser_power_excursion.csv` are byte-identical to before.

### Check values from the generator script (not a test of the tool)

Computed on builds 1-20 by the tool's `analyze()` (X-bar/R, A2 = 0.577, d2 = 2.326): Cpl for UTS vs
LSL 900, Cpu for porosity vs USL 0.5.

| File | UTS X-bar-bar | UTS R-bar | UTS sigma-hat | UTS Cpl | Porosity X-bar-bar | Porosity R-bar | Porosity sigma-hat | Porosity Cpu |
|---|---|---|---|---|---|---|---|---|
| `capable_baseline.csv` | 973.04 | 11.78 | 5.06 | 4.81 | 0.214 | 0.060 | 0.026 | 3.70 |
| `oxygen_drift.csv` | 973.44 | 12.29 | 5.28 | 4.64 | 0.207 | 0.065 | 0.028 | 3.51 |
| `laser_power_excursion.csv` | 973.65 | 11.34 | 4.88 | 5.04 | 0.207 | 0.064 | 0.028 | 3.54 |
| `marginal_spread.csv` | 973.04 | 11.78 | 5.06 | 4.81 | 0.214 | 0.060 | 0.026 | 3.70 |

Build means, builds 20 to 30 (shows where the planted signal appears):

| File | UTS (MPa) | Porosity (%) |
|---|---|---|
| `capable_baseline.csv` | 966.9, 974.6, 973.0, 972.4, 979.3, 975.6, 973.9, 976.7, 968.9, 972.7, 974.9 | 0.203, 0.203, 0.190, 0.230, 0.214, 0.204, 0.194, 0.209, 0.200, 0.193, 0.218 |
| `oxygen_drift.csv` | 978.4, 974.6, 967.8, 962.0, 961.3, 958.6, 953.4, 945.3, 946.9, 939.1, 934.0 | 0.189, 0.182, 0.230, 0.242, 0.266, 0.277, 0.321, 0.387, 0.376, 0.395, 0.426 |
| `laser_power_excursion.csv` | 969.5, 971.8, 976.2, 970.6, 943.2, 942.3, 939.2, 975.7, 974.9, 973.5, 969.4 | 0.209, 0.235, 0.218, 0.227, 0.439, 0.450, 0.453, 0.171, 0.209, 0.198, 0.227 |

### What the tool reports on these files (default specs)

- `marginal_spread.csv`: no rule fires on any chart, including all eight build-parameter I-MR charts, so the first out-of-control build is none and all 30 builds are RELEASE. Process capable = no only because the dimensional deviation index is low: Cpk 1.192 (Cp 1.199, Cpl 1.206, Cpu 1.192; within-build sigma 0.0278 mm), reliable and below 1.33. Tensile strength Cpl 4.81 and porosity Cpu 3.70 are the same as in `capable_baseline.csv` and meet the minimum. The tool also notes that the dimensional baseline looks non-normal (Shapiro-Wilk p = 0.0075, a chance result), so that index is approximate.

- `capable_baseline.csv`: process capable = yes; all 30 builds RELEASE; no rule broken on any
  quality chart and no rule fires on any build-parameter I-MR chart (all 8 Nelson rules).
- `oxygen_drift.csv`: no rule fires in builds 1-20 on any chart; first out-of-control build B-1023;
  builds 1023-1030 are QUARANTINE with chamber oxygen top of "investigate first"; process capable = no.
  UTS stays above the 900 LSL (lowest build mean 934), so the drift is caught before parts fail
  spec; the indices are printed but marked not reliable.
- `laser_power_excursion.csv`: no rule fires in builds 1-20; first out-of-control build B-1024; builds
  1024-1026 QUARANTINE with laser power top of "investigate first"; builds 1027-1030 RELEASE.
  Disclosed chance alarms: a dimensional X-bar rule 1 on B-1025 (a coincidence, not planted); and
  after recovery the parameter charts show laser power MR at 1027 and 1030, humidity MR at 1028 and
  humidity rule 5 at 1030. None of these changes a disposition after build 1026. Because the dimensional chart is
  out of control, its Cpk is marked not reliable.

## What it would take to collect this data for real

| Data | How it is collected | How often |
|---|---|---|
| Coupon IDs, UTS, yield, elongation | 5 witness coupons printed on each build plate, machined and pulled on a tensile frame (ASTM E8 style); the lab exports results (LIMS). | 5 coupons per build, every build (about one per 2 days here). |
| Porosity | Metallographic cross-section or CT scan of a witness coupon. | Every build, same 5 coupons (CT is slower and costs more than sectioning). |
| Dimensional deviation | CMM or caliper measurement of the coupon against the drawing. | Every coupon. |
| Laser power, scan speed, layer thickness, chamber oxygen, humidity, powder bed and plate temperature | Printer layer log (sensor data per layer), averaged over all layers of the build. | Logged continuously per layer; one mean per build. |
| Stress-relief temperature | Heat-treat furnace record (thermocouple chart) for the build's load. | Once per build or furnace load. |
| Machine and powder lot | Build traveler / ERP record. | Once per build. |

The two sources (lab report and printer/furnace logs) are joined on `build_id`.

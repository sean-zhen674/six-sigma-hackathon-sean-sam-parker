"""Generate the three simulated AeroPrint test datasets (all data is invented).

Run from the repo root:   .venv/Scripts/python.exe data/generate.py
Same seed -> identical CSVs on every machine.

Each file: 30 builds x 5 coupons = 150 rows. The build parameters are drawn once per
build and repeated on its 5 coupon rows. Coupon results depend on those parameters
(a small linear effect) plus independent noise per coupon.
"""
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 5300  # base seed; each scenario uses SEED + k
# The k values were found by scanning k = 0, 1, 2, ... and keeping the first seed whose
# baseline (builds 1-20) raises no chance alarm under the tool's 8 Nelson rules and
# whose planted story then plays out as designed. See data/README.md.
SCENARIO_SEEDS = {
    "capable_baseline": SEED + 36,        # 5336
    "oxygen_drift": SEED + 22,            # 5322
    "laser_power_excursion": SEED + 18,   # 5318
}
N_BUILDS = 30
N_COUPONS = 5
OUT_DIR = Path(__file__).resolve().parent

COLUMNS = [
    "build_id", "coupon_id", "build_timestamp", "machine_id", "material_lot",
    "uts_MPa", "yield_MPa", "elongation_pct", "porosity_pct", "dimensional_dev_mm",
    "pass_fail",
    "laser_power_W", "scan_speed_mm_s", "layer_thickness_um", "chamber_oxygen_ppm",
    "humidity_pct", "powder_bed_temp_C", "build_plate_temp_C", "stress_relief_temp_C",
]

# Effect sizes (per unit away from nominal in the bad direction).
UTS_PER_PPM = 0.12      # MPa lost per ppm oxygen above 100
UTS_PER_W = 0.8         # MPa lost per W below 280
POR_PER_PPM = 0.0007    # % porosity gained per ppm oxygen above 100
POR_PER_W = 0.006       # % porosity gained per W below 280
ELONG_PER_PPM = 0.004   # % elongation lost per ppm oxygen above 100


def build_parameters(rng, scenario):
    """One row of printer/furnace parameters per build (before coupon testing)."""
    n = N_BUILDS
    p = pd.DataFrame({
        "laser_power_W": rng.normal(280, 1.5, n),
        "scan_speed_mm_s": rng.normal(1200, 5, n),
        "layer_thickness_um": rng.normal(30, 0.3, n),
        "chamber_oxygen_ppm": rng.normal(100, 8, n),
        "humidity_pct": rng.normal(35, 2, n),
        "powder_bed_temp_C": rng.normal(180, 1.5, n),
        "build_plate_temp_C": rng.normal(200, 1.5, n),
        "stress_relief_temp_C": rng.normal(650, 3, n),
    })
    if scenario == "oxygen_drift":
        # Builds 21..30 (index 20..29): oxygen creeps up linearly to about 430 ppm.
        creep = np.linspace(0, 1, 10)
        p.loc[20:, "chamber_oxygen_ppm"] = 100 + 330 * creep + rng.normal(0, 8, 10)
    if scenario == "laser_power_excursion":
        # Builds 24, 25, 26 (index 23..25): laser power drops about 15 %.
        p.loc[23:25, "laser_power_W"] = 238 + rng.normal(0, 1.5, 3)
    return p


def make_scenario(scenario, seed):
    rng = np.random.default_rng(seed)  # one rng per scenario
    params = build_parameters(rng, scenario)
    build_effect_uts = rng.normal(0, 1, N_BUILDS)  # small build-to-build sd ~1

    rows = []
    start = pd.Timestamp("2026-01-05 08:00")
    for b in range(N_BUILDS):
        pr = params.iloc[b]
        o2_excess = max(0.0, pr.chamber_oxygen_ppm - 100)
        power_short = max(0.0, 280 - pr.laser_power_W)
        uts_mean = (975 + build_effect_uts[b]
                    - UTS_PER_PPM * o2_excess - UTS_PER_W * power_short)
        por_mean = 0.20 + POR_PER_PPM * o2_excess + POR_PER_W * power_short
        elong_mean = 10 - ELONG_PER_PPM * o2_excess

        for c in range(N_COUPONS):  # independent noise for every coupon
            uts = uts_mean + rng.normal(0, 5)
            yld = 0.9 * uts + rng.normal(0, 4)
            elong = elong_mean + rng.normal(0, 0.4)
            por = por_mean * rng.lognormal(0, 0.125)  # skewed, always > 0
            dev = rng.normal(0, 0.02)
            uts, yld, elong = round(uts, 1), round(yld, 1), round(elong, 2)
            por, dev = round(por, 3), round(dev, 3)
            ok = bool(uts >= 900 and por <= 0.5 and abs(dev) <= 0.10)
            rows.append({
                "build_id": f"B-{1001 + b}",
                "coupon_id": f"C-{1001 + b}-{c + 1:02d}",
                "build_timestamp": (start + pd.Timedelta(days=2 * b)).isoformat(),
                "machine_id": "AM-01" if (b // 5) % 2 == 0 else "AM-02",
                "material_lot": f"Ti64-Lot-{21 + b // 10}",
                "uts_MPa": uts, "yield_MPa": yld, "elongation_pct": elong,
                "porosity_pct": por, "dimensional_dev_mm": dev, "pass_fail": ok,
                "laser_power_W": round(pr.laser_power_W, 1),
                "scan_speed_mm_s": round(pr.scan_speed_mm_s, 1),
                "layer_thickness_um": round(pr.layer_thickness_um, 2),
                "chamber_oxygen_ppm": round(pr.chamber_oxygen_ppm, 1),
                "humidity_pct": round(pr.humidity_pct, 1),
                "powder_bed_temp_C": round(pr.powder_bed_temp_C, 1),
                "build_plate_temp_C": round(pr.build_plate_temp_C, 1),
                "stress_relief_temp_C": round(pr.stress_relief_temp_C, 1),
            })
    return pd.DataFrame(rows, columns=COLUMNS)


def main():
    for name, seed in SCENARIO_SEEDS.items():
        df = make_scenario(name, seed)
        path = OUT_DIR / f"{name}.csv"
        df.to_csv(path, index=False, lineterminator="\n")
        print(f"wrote {path.name}: {len(df)} rows")


if __name__ == "__main__":
    main()

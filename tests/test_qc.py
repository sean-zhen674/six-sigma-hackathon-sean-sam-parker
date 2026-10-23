"""Tests for app/qc.py (task H-03).

Every expected number below was worked out by hand (SPEC.md section 4), not copied from the code.
Run from the repo root:  .venv/Scripts/python.exe -m pytest tests -q
"""
import json

import numpy as np
import pandas as pd
import pytest

from app.qc import (
    analyze,
    capability,
    disposition,
    imr,
    nelson,
    rank_parameters,
    xbar_r,
)

# ---------------------------------------------------------------------------
# 1. Known answers (SPEC.md section 4)
# ---------------------------------------------------------------------------

KNOWN_UTS = {
    "B1": [945, 952, 950, 948, 955],  # mean 950, range 10
    "B2": [951, 953, 955, 957, 959],  # mean 955, range 8
    "B3": [939, 951, 945, 947, 943],  # mean 945, range 12
}


def known_frame():
    rows = [(b, v) for b, vals in KNOWN_UTS.items() for v in vals]
    return pd.DataFrame(rows, columns=["build_id", "uts_MPa"])


def test_xbar_r_known_answer():
    r = xbar_r(known_frame(), "build_id", "uts_MPa")
    assert r["means"] == [950.0, 955.0, 945.0]
    assert r["ranges"] == [10.0, 8.0, 12.0]
    assert r["xbarbar"] == pytest.approx(950.0)
    assert r["rbar"] == pytest.approx(10.0)
    assert r["xbar_ucl"] == pytest.approx(955.77, abs=0.005)  # 950 + 0.577*10
    assert r["xbar_lcl"] == pytest.approx(944.23, abs=0.005)  # 950 - 0.577*10
    assert r["r_ucl"] == pytest.approx(21.14, abs=0.005)  # 2.114*10
    assert r["r_lcl"] == 0.0
    assert r["sigma_hat"] == pytest.approx(10 / 2.326)  # 4.2992
    assert r["sigma_hat"] == pytest.approx(4.2992, abs=0.00005)
    assert r["baseline_n_used"] == 3  # fewer builds than baseline_n: all builds used
    assert "all 3 builds" in r["baseline_note"]
    # all three builds are in control
    assert all(v == [] for v in r["xbar_flags"].values())
    assert r["r_flags"] == []


def test_capability_known_answer():
    # one-sided UTS: Cpl = (950 - 900) / (3 * 4.2992) = 3.877
    c = capability(950.0, 10.0, lsl=900)
    assert c["cpl"] == pytest.approx(3.877, abs=0.0005)
    assert c["cpk"] == pytest.approx(3.877, abs=0.0005)  # only one side exists
    assert c["cp"] is None and c["cpu"] is None
    assert c["reliable"] is True and c["capable"] is True


def test_capability_two_sided_known_answer():
    # spec 930-970: Cp = 40 / (6*4.2992) = 1.551, Cpk = min(20,20)/(3*4.2992) = 1.551
    c = capability(950.0, 10.0, lsl=930, usl=970)
    assert c["cp"] == pytest.approx(1.551, abs=0.0005)
    assert c["cpk"] == pytest.approx(1.551, abs=0.0005)
    assert c["cpu"] == pytest.approx(1.551, abs=0.0005)
    assert c["cpl"] == pytest.approx(1.551, abs=0.0005)
    assert c["capable"] is True  # 1.551 >= 1.33


def test_capability_off_centre_cpk_below_cp():
    # mean 960, spec 930-970: Cpk = min(10, 30) / 12.8977 = 0.775 ; Cp = 1.551
    c = capability(960.0, 10.0, lsl=930, usl=970)
    assert c["cp"] == pytest.approx(1.551, abs=0.0005)
    assert c["cpk"] == pytest.approx(0.775, abs=0.0005)
    assert c["capable"] is False


def test_capability_not_reliable_when_out_of_control():
    c = capability(950.0, 10.0, lsl=900, in_control=False)
    assert c["cpl"] == pytest.approx(3.877, abs=0.0005)  # still printed
    assert c["reliable"] is False
    assert c["capable"] is False  # but never "capable"


def test_imr_known_answer():
    r = imr([100, 120, 110, 130, 140])
    assert r["cl"] == pytest.approx(120.0)
    assert r["moving_ranges"] == [20.0, 10.0, 20.0, 10.0]
    assert r["mr_bar"] == pytest.approx(15.0)
    assert r["sigma"] == pytest.approx(13.298, abs=0.0005)  # 15 / 1.128
    assert r["ucl"] == pytest.approx(159.89, abs=0.005)
    assert r["lcl"] == pytest.approx(80.11, abs=0.005)
    assert r["mr_ucl"] == pytest.approx(49.005, abs=0.0005)  # 3.267 * 15
    assert r["mr_flags"] == []


# ---------------------------------------------------------------------------
# 2. Nelson rules: one planted series per rule (cl = 0, sigma = 1)
# ---------------------------------------------------------------------------

def test_nelson_rule1():
    out = nelson([0.5, -0.5, 0.5, -0.5, 4.0], 0, 1)
    assert out[1] == [4]
    assert all(out[k] == [] for k in range(2, 9))


def test_nelson_rule2_nine_same_side():
    out = nelson([0.5] * 9, 0, 1)
    assert out[2] == [8]  # the 9th point completes it
    assert nelson([0.5] * 8, 0, 1)[2] == []


def test_nelson_rule3_six_rising():
    out = nelson([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 0, 1)
    assert out[3] == [5]
    assert nelson([0.6, 0.5, 0.4, 0.3, 0.2, 0.1], 0, 1)[3] == [5]  # falling too
    assert nelson([0.1, 0.2, 0.3, 0.4, 0.5], 0, 1)[3] == []  # only 5 points


def test_nelson_rule4_fourteen_alternating():
    out = nelson([0.5, -0.5] * 7, 0, 1)
    assert out[4] == [13]
    assert nelson([0.5, -0.5] * 6 + [0.5], 0, 1)[4] == []  # 13 points only


def test_nelson_rule5_two_of_three_beyond_2sigma():
    out = nelson([0.0, 2.5, 0.0, 2.5], 0, 1)
    assert out[5] == [3]
    # 2.5 and -2.5 are on opposite sides: no flag
    assert nelson([0.0, 2.5, 0.0, -2.5], 0, 1)[5] == []


def test_nelson_rule6_four_of_five_beyond_1sigma():
    out = nelson([1.5, 1.5, 0.0, 1.5, 1.5], 0, 1)
    assert out[6] == [4]
    assert out[5] == [] and out[1] == []


def test_nelson_rule7_fifteen_within_1sigma():
    out = nelson([0.5, -0.5] * 7 + [0.5], 0, 1)
    assert out[7] == [14]
    assert nelson([0.5, -0.5] * 7, 0, 1)[7] == []  # 14 points only


def test_nelson_rule8_eight_beyond_1sigma_either_side():
    out = nelson([1.5, -1.5] * 4, 0, 1)
    assert out[8] == [7]
    assert nelson([1.5, -1.5] * 3 + [1.5, 0.0], 0, 1)[8] == []  # a point inside 1 sigma


def test_nelson_clean_series_flags_nothing():
    clean = [0.5, -0.3, 0.2, -0.6, 0.4, 0.1, -0.2, 0.7, -0.5, 0.3]
    out = nelson(clean, 0, 1)
    assert all(out[k] == [] for k in range(1, 9))


def test_nelson_spec_planted_checks():
    sigma_xbar = 0.577 * 10 / 3  # 1.9233, as in SPEC section 4
    # a build mean of 920 against the known-answer limits -> rule 1
    assert nelson([950, 950.5, 949.5, 920], 950, sigma_xbar)[1] == [3]
    # nine means at 951 -> rule 2 on the 9th
    assert nelson([951] * 9, 950, sigma_xbar)[2] == [8]
    # 946..951 -> rule 3 on the 6th
    assert nelson([946, 947, 948, 949, 950, 951], 950, sigma_xbar)[3] == [5]


def test_nelson_zero_sigma_flags_nothing():
    out = nelson([1, 2, 3, 100], 0, 0)
    assert all(out[k] == [] for k in range(1, 9))


# ---------------------------------------------------------------------------
# 3. Degenerate cases
# ---------------------------------------------------------------------------

def test_constant_coupons_give_none_not_inf_or_zero():
    rows = [(f"B{i}", 950.0) for i in range(1, 6) for _ in range(5)]
    df = pd.DataFrame(rows, columns=["build_id", "uts_MPa"])
    r = xbar_r(df, "build_id", "uts_MPa")
    assert r["rbar"] == 0.0 and r["sigma_hat"] == 0.0
    assert "zero within-build variation" in r["message"]
    c = capability(r["xbarbar"], r["rbar"], lsl=930, usl=970)
    for key in ("cp", "cpk", "cpl", "cpu", "capable"):
        assert c[key] is None
    assert "zero within-build variation" in c["message"]


def test_one_build_or_short_build_raises():
    with pytest.raises(ValueError, match="at least 2 builds"):
        xbar_r(known_frame().iloc[:5], "build_id", "uts_MPa")
    short = known_frame().drop(index=0)  # B1 now has 4 coupons
    with pytest.raises(ValueError, match="exactly 5"):
        xbar_r(short, "build_id", "uts_MPa")


def test_xbar_r_nan_raises():
    df = known_frame()
    df.loc[2, "uts_MPa"] = np.nan
    with pytest.raises(ValueError, match="missing"):
        xbar_r(df, "build_id", "uts_MPa")


def test_imr_degenerate():
    with pytest.raises(ValueError):
        imr([5.0])
    r = imr([7.0, 7.0, 7.0, 7.0])
    assert r["sigma"] == 0.0
    assert "no variation" in r["message"]
    assert all(v == [] for v in r["flags"].values())
    assert r["ucl"] is None and r["lcl"] is None


def test_disposition_order():
    # build 0: rule fired (even though also out of spec) -> QUARANTINE
    # build 1: no rule, a coupon out of spec -> RETEST ; build 2: clean -> RELEASE
    out = disposition([["uts X-bar rule 1"], [], []], [True, True, False])
    assert out == ["QUARANTINE", "RETEST", "RELEASE"]


# ---------------------------------------------------------------------------
# 4. analyze() on a synthetic data set with planted problems
# ---------------------------------------------------------------------------

PARAMS = {
    "laser_power_W": (300, 2),
    "scan_speed_mm_s": (1000, 5),
    "layer_thickness_um": (30, 0.2),
    "chamber_oxygen_ppm": (100, 5),
    "humidity_pct": (40, 1),
    "powder_bed_temp_C": (150, 1),
    "build_plate_temp_C": (200, 1),
    "stress_relief_temp_C": (800, 2),
}


def synthetic(n_builds=30, shift_from=24, seed=7, constant_uts=False):
    rng = np.random.default_rng(seed)
    rows = []
    start = pd.Timestamp("2026-01-01")
    for b in range(n_builds):
        shifted = b >= shift_from
        params = {k: rng.normal(m, s) for k, (m, s) in PARAMS.items()}
        if shifted:
            params["chamber_oxygen_ppm"] += 80  # planted parameter shift
        for c in range(5):
            uts = 950.0 if constant_uts else rng.normal(950, 4) - (25 if shifted else 0)
            rows.append({
                "build_id": f"B{b + 1:02d}", "coupon_id": f"B{b + 1:02d}-{c + 1}",
                "build_timestamp": (start + pd.Timedelta(days=b)).isoformat(),
                "machine_id": "M1", "material_lot": "L1",
                "uts_MPa": uts, "yield_MPa": uts - 60, "elongation_pct": 10.0,
                "porosity_pct": abs(rng.normal(0.2, 0.03)),
                "dimensional_dev_mm": rng.normal(0, 0.02),
                "pass_fail": "pass", **params,
            })
    return pd.DataFrame(rows)


def test_analyze_json_safe_and_planted_signal():
    df = synthetic().sample(frac=1, random_state=3)  # shuffled rows: analyze must sort by time
    result = analyze(df)
    text = json.dumps(result, allow_nan=False)  # fails on numpy types or NaN
    assert isinstance(text, str)

    builds = result["builds"]
    assert len(builds) == 30
    assert [b["build_id"] for b in builds][:3] == ["B01", "B02", "B03"]  # time order
    planted = builds[24]  # first shifted build (B25)
    assert planted["disposition"] == "QUARANTINE"
    assert "uts X-bar rule 1" in planted["rules_broken"]
    names = [p["parameter"] for p in planted["investigate_first"]]
    assert names[0] == "chamber_oxygen_ppm"  # biggest |z| is the planted oxygen shift
    assert result["first_out_of_control_build"] is not None
    assert result["process_capable"] is False  # UTS chart is out of control
    assert result["capability"]["uts_MPa"]["reliable"] is False
    assert set(result["charts"]) >= {"uts_MPa", "porosity_pct", "dimensional_dev_mm", "imr"}
    assert "chamber_oxygen_ppm" in result["charts"]["imr"]
    assert result["settings"]["baseline_n"] == 20
    assert result["capability"]["porosity_pct"]["normality_warning"]  # porosity always warns


def test_analyze_constant_coupons_gives_none():
    result = analyze(synthetic(constant_uts=True))
    json.dumps(result, allow_nan=False)
    cap = result["capability"]["uts_MPa"]
    assert cap["cpl"] is None and cap["cpk"] is None
    assert "zero within-build variation" in cap["message"]
    assert result["process_capable"] is False


def test_analyze_missing_column_and_nan_raise():
    df = synthetic()
    with pytest.raises(ValueError, match="uts_MPa"):
        analyze(df.drop(columns=["uts_MPa"]))
    bad = df.copy()
    bad.loc[3, "porosity_pct"] = np.nan
    with pytest.raises(ValueError, match="porosity_pct"):
        analyze(bad)


def test_rank_parameters_skips_constant_parameter():
    params = pd.DataFrame({
        "chamber_oxygen_ppm": [100, 102, 98, 101, 99, 100, 150],
        "laser_power_W": [300.0] * 7,  # zero baseline sigma
    })
    out = rank_parameters(params, baseline_n=6)
    assert "laser_power_W" in out["skipped"]
    assert "zero" in out["skipped"]["laser_power_W"]
    assert out["ranking"][6][0]["parameter"] == "chamber_oxygen_ppm"

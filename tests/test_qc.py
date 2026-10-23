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


# ---------------------------------------------------------------------------
# 5. H-10: minimal upload format (5 required columns, optional parameters, extras ignored)
# ---------------------------------------------------------------------------
from pathlib import Path  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MINIMAL = ["build_id", "build_timestamp", "uts_MPa", "porosity_pct", "dimensional_dev_mm"]
PARAM_NAMES = list(PARAMS)


def minimal_frame(n_builds=30, **kw):
    """The synthetic data cut down to the 5 required columns."""
    return synthetic(n_builds=n_builds, **kw)[MINIMAL]


def test_five_column_file_equals_full_file_for_the_quality_statistics():
    full = analyze(synthetic())
    small = analyze(minimal_frame())
    for col in ("uts_MPa", "porosity_pct", "dimensional_dev_mm"):
        assert small["charts"][col] == full["charts"][col]
        assert small["capability"][col] == full["capability"][col]
    assert [b["disposition"] for b in small["builds"]] == [b["disposition"] for b in full["builds"]]
    assert [b["rules_broken"] for b in small["builds"]] == [b["rules_broken"] for b in full["builds"]]
    assert small["charts"]["imr"] == {}
    assert small["settings"]["parameters_used"] == []
    assert small["settings"]["parameters_missing"] == PARAM_NAMES


def test_no_parameter_columns_gives_empty_investigate_first_and_a_warning():
    result = analyze(minimal_frame())
    assert all(b["investigate_first"] == [] for b in result["builds"])
    assert 'No print-parameter columns found: the "investigate first" ranking is skipped.' in result["warnings"]
    assert result["builds"][24]["disposition"] == "QUARANTINE"  # still flagged by UTS
    json.dumps(result, allow_nan=False)


def test_only_one_parameter_column_gives_one_chart_and_names_only_it():
    df = synthetic()[MINIMAL + ["chamber_oxygen_ppm"]]
    result = analyze(df)
    assert list(result["charts"]["imr"]) == ["chamber_oxygen_ppm"]
    assert result["settings"]["parameters_used"] == ["chamber_oxygen_ppm"]
    assert len(result["settings"]["parameters_missing"]) == 7
    named = {p["parameter"] for b in result["builds"] for p in b["investigate_first"]}
    assert named == {"chamber_oxygen_ppm"}
    assert any(w.startswith("Print-parameter columns not found") and "laser_power_W" in w
               for w in result["warnings"])


def test_all_parameters_present_adds_no_missing_warning():
    result = analyze(synthetic())
    assert result["settings"]["parameters_missing"] == []
    assert result["settings"]["parameters_used"] == PARAM_NAMES
    assert not any("rint-parameter" in w for w in result["warnings"])


def test_parameter_that_varies_inside_a_build_is_averaged():
    df = minimal_frame(n_builds=6)
    # oxygen differs per coupon (90..110, mean 100); each build is shifted by 0, 2, -1, 1, 0, 50
    ox = np.tile([90.0, 95.0, 100.0, 105.0, 110.0], 6) + np.repeat([0, 2, -1, 1, 0, 50], 5)
    df["chamber_oxygen_ppm"] = ox
    chart = analyze(df, baseline_n=5)["charts"]["imr"]["chamber_oxygen_ppm"]
    assert chart["points"] == pytest.approx([100.0, 102.0, 99.0, 101.0, 100.0, 150.0])


def test_ignored_columns_may_hold_nan_or_junk():
    df = synthetic()
    df.loc[0, "yield_MPa"] = np.nan
    df.loc[1, "pass_fail"] = np.nan
    df.loc[2, "machine_id"] = np.nan
    df["coupon_id"] = "text, with, commas"
    df["notes"] = [None if i % 2 else "free text" for i in range(len(df))]
    df["junk_numbers"] = 1.0
    assert analyze(df) == analyze(synthetic())


def test_missing_required_columns_are_named():
    df = minimal_frame().drop(columns=["uts_MPa", "build_timestamp"])
    with pytest.raises(ValueError) as err:
        analyze(df)
    assert "missing required columns" in str(err.value)
    assert "uts_MPa" in str(err.value) and "build_timestamp" in str(err.value)


def test_non_numeric_text_names_column_and_value():
    df = minimal_frame()
    df["porosity_pct"] = df["porosity_pct"].astype(object)
    df.loc[7, "porosity_pct"] = "0.2 %"
    with pytest.raises(ValueError, match=r"porosity_pct.*non-numeric.*'0\.2 %'"):
        analyze(df)


def test_non_numeric_text_in_an_optional_parameter_is_also_rejected():
    df = synthetic()[MINIMAL + ["humidity_pct"]]
    df["humidity_pct"] = df["humidity_pct"].astype(object)
    df.loc[4, "humidity_pct"] = "damp"
    with pytest.raises(ValueError, match=r"humidity_pct.*non-numeric.*'damp'"):
        analyze(df)


def test_blank_in_a_used_column_names_the_column():
    df = minimal_frame()
    df.loc[3, "dimensional_dev_mm"] = np.nan
    with pytest.raises(ValueError, match=r"dimensional_dev_mm.*blank or missing.*row 5"):
        analyze(df)
    df = synthetic()
    df.loc[3, "scan_speed_mm_s"] = np.nan
    with pytest.raises(ValueError, match="scan_speed_mm_s"):
        analyze(df)


def test_unparseable_timestamp_is_named():
    df = minimal_frame()
    df["build_timestamp"] = df["build_timestamp"].astype(object)
    df.loc[0, "build_timestamp"] = "last Tuesday"
    with pytest.raises(ValueError, match=r"build_timestamp is not a valid date/time.*last Tuesday"):
        analyze(df)


def test_four_coupon_build_names_build_and_count():
    df = minimal_frame().drop(index=7)
    with pytest.raises(ValueError) as err:
        analyze(df)
    assert "build B02 has 4 coupons; each build needs exactly 5 coupons" in str(err.value)
    df = pd.concat([minimal_frame(), minimal_frame().iloc[[0]]])  # B01 now has 6
    with pytest.raises(ValueError, match="build B01 has 6 coupons"):
        analyze(df)


def test_known_answer_through_the_minimal_template():
    """SPEC section 4 builds, uploaded as the 5-column template: Xbarbar 950, Cpl 3.877."""
    df = pd.read_csv(ROOT / "data" / "template" / "aeroprint_template.csv")
    assert list(df.columns) == MINIMAL and len(df) == 15
    result = analyze(df)
    uts = result["charts"]["uts_MPa"]
    assert uts["xbar"]["cl"] == pytest.approx(950.0)
    assert uts["xbar"]["ucl"] == pytest.approx(955.77, abs=0.005)
    assert uts["xbar"]["lcl"] == pytest.approx(944.23, abs=0.005)
    assert uts["r"]["ucl"] == pytest.approx(21.14, abs=0.005)
    assert result["capability"]["uts_MPa"]["cpl"] == pytest.approx(3.877, abs=0.0005)
    assert [b["disposition"] for b in result["builds"]] == ["RELEASE"] * 3


def test_template_with_parameters_uses_all_eight():
    df = pd.read_csv(ROOT / "data" / "template" / "aeroprint_template_with_parameters.csv")
    result = analyze(df)
    assert result["settings"]["parameters_used"] == PARAM_NAMES
    assert result["capability"]["uts_MPa"]["cpl"] == pytest.approx(3.877, abs=0.0005)


# H-10 regression: the sample datasets must give the numbers they gave before the change.
SAMPLES = {
    # name: (process_capable, first out of control, top suspect, Cpl uts, Cpu porosity, Cpk dimensional)
    "capable_baseline": (True, None, None, 4.810, 3.695, 1.792),
    "oxygen_drift": (False, "B-1023", "chamber_oxygen_ppm", 4.635, 3.511, 1.416),
    # H-14: in control, only the dimensional Cpk (1.192) is below 1.33
    "marginal_spread": (False, None, None, 4.810, 3.695, 1.192),
}


@pytest.mark.parametrize("name", list(SAMPLES))
def test_sample_datasets_keep_their_numbers(name):
    capable, first, suspect, cpl, cpu, cpk = SAMPLES[name]
    result = analyze(pd.read_csv(ROOT / "data" / f"{name}.csv"))
    assert result["process_capable"] is capable
    assert result["first_out_of_control_build"] == first
    cap = result["capability"]
    assert cap["uts_MPa"]["cpl"] == pytest.approx(cpl, abs=0.0005)
    assert cap["porosity_pct"]["cpu"] == pytest.approx(cpu, abs=0.0005)
    assert cap["dimensional_dev_mm"]["cpk"] == pytest.approx(cpk, abs=0.0005)
    assert len(result["settings"]["parameters_used"]) == 8
    if suspect:
        build = next(b for b in result["builds"] if b["build_id"] == first)
        assert build["investigate_first"][0]["parameter"] == suspect


# ---------------------------------------------------------------------------
# 6. H-10 review fixes: infinite values, True/False and other odd columns, shared timestamps
# ---------------------------------------------------------------------------
import warnings as _warnings  # noqa: E402


def test_infinite_value_in_a_required_column_names_column_and_row():
    df = minimal_frame()
    df["uts_MPa"] = df["uts_MPa"].astype(float)
    df.loc[5, "uts_MPa"] = np.inf
    with pytest.raises(ValueError) as err:
        analyze(df)
    assert "column 'uts_MPa' has an infinite value (row 7 of the file); use ordinary numbers" in str(err.value)
    df.loc[5, "uts_MPa"] = -np.inf
    with pytest.raises(ValueError, match="infinite value"):
        analyze(df)


def test_too_large_number_counts_as_infinite_in_an_optional_column():
    df = synthetic()[MINIMAL + ["humidity_pct"]]
    df["humidity_pct"] = df["humidity_pct"].astype(object)
    df.loc[2, "humidity_pct"] = "1e400"  # larger than any float: becomes inf
    with pytest.raises(ValueError, match=r"column 'humidity_pct' has an infinite value \(row 4 of the file\)"):
        analyze(df)
    df = synthetic()[MINIMAL + ["humidity_pct"]]
    df.loc[2, "humidity_pct"] = np.inf
    with pytest.raises(ValueError, match="humidity_pct.*infinite"):
        analyze(df)


def test_true_false_column_is_a_value_error_not_a_type_error():
    df = minimal_frame()
    df["uts_MPa"] = [True, False] * 75
    with pytest.raises(ValueError, match="column 'uts_MPa' contains True/False values; it must contain numbers"):
        analyze(df)
    df = synthetic()[MINIMAL + ["laser_power_W"]]
    df["laser_power_W"] = df["laser_power_W"].astype(object)
    df.loc[0, "laser_power_W"] = True  # one True in an otherwise numeric (object) column
    with pytest.raises(ValueError, match="laser_power_W.*True/False"):
        analyze(df)


def test_other_odd_columns_are_value_errors():
    df = minimal_frame()
    df["porosity_pct"] = [1 + 2j] * 150
    with pytest.raises(ValueError, match="porosity_pct"):
        analyze(df)
    df = minimal_frame()
    df["uts_MPa"] = pd.to_datetime(["2026-01-01"] * 150)
    with pytest.raises(ValueError, match="column 'uts_MPa' contains dates or times; it must contain numbers"):
        analyze(df)
    df = minimal_frame()
    df["uts_MPa"] = [[1, 2]] * 150
    with pytest.raises(ValueError, match="uts_MPa"):
        analyze(df)
    df = pd.concat([minimal_frame(), minimal_frame()[["uts_MPa"]]], axis=1)  # header lists uts_MPa twice
    with pytest.raises(ValueError, match="column 'uts_MPa' appears 2 times in the header; keep only one"):
        analyze(df)


def test_header_only_file():
    with pytest.raises(ValueError, match="the file has a header but no data rows"):
        analyze(minimal_frame().iloc[0:0])


def test_bad_timestamp_message_is_short_and_raises_no_pandas_warning():
    df = minimal_frame()
    df["build_timestamp"] = df["build_timestamp"].astype(object)
    df.loc[0, "build_timestamp"] = "last Tuesday"
    with _warnings.catch_warnings():
        _warnings.simplefilter("error")  # any pandas UserWarning would fail the test
        with pytest.raises(ValueError) as err:
            analyze(df)
    assert str(err.value) == ("build_timestamp is not a valid date/time (for example 'last Tuesday'); "
                              "use a form like 2026-01-05T08:00:00")


def test_shared_timestamps_give_a_warning_and_change_nothing_else():
    df = minimal_frame(n_builds=10)
    df.loc[df["build_id"] == "B02", "build_timestamp"] = df.loc[df["build_id"] == "B01", "build_timestamp"].iloc[0]
    result = analyze(df, baseline_n=5)
    expected = ("2 builds share the same build_timestamp (for example B01 and B02); builds with the same "
                "timestamp are ordered by their position in the file, which changes which builds form the "
                "baseline. Give every build its own timestamp.")
    assert expected in result["warnings"]
    assert result["build_ids"][:2] == ["B01", "B02"]  # ties keep the file order
    # remove only that warning: everything else equals the run with the same data and distinct timestamps
    clean = analyze(minimal_frame(n_builds=10), baseline_n=5)
    assert not any("share the same build_timestamp" in w for w in clean["warnings"])
    assert [w for w in result["warnings"] if w != expected] == clean["warnings"]
    assert result["capability"]["porosity_pct"] == clean["capability"]["porosity_pct"]
    assert result["charts"]["uts_MPa"]["r"] == clean["charts"]["uts_MPa"]["r"]


def test_samples_and_templates_have_no_timestamp_tie_warning():
    for name in SAMPLES:
        result = analyze(pd.read_csv(ROOT / "data" / f"{name}.csv"))
        assert not any("share the same build_timestamp" in w for w in result["warnings"])

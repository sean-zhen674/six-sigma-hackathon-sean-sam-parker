"""AeroPrint QC statistics: plain functions, no web framework (task H-03).

Method (SPEC.md section 4): one subgroup is the 5 coupons of one build.
  X-bar chart  CL = Xbarbar,  limits Xbarbar +/- A2 * Rbar
  R chart      CL = Rbar,     UCL = D4 * Rbar,  LCL = D3 * Rbar = 0
  sigma_hat    = Rbar / d2     (within-build sigma; NOT the overall standard deviation)
  I-MR chart   CL = mean, sigma = MRbar / 1.128, limits CL +/- 3 sigma, MR UCL = 3.267 * MRbar
Limits come from a baseline (the first `baseline_n` builds in time order).
Assumptions: coupons within a build are a rational subgroup, values are roughly normal,
the baseline is in control, builds are independent and in time order.
"""
import math

import numpy as np
import pandas as pd
from scipy import stats

# Constants for subgroup size n = 5 (X-bar and R) and moving range of 2 (I-MR).
A2 = 0.577
D3 = 0.0
D4 = 2.114
D2 = 2.326
SUBGROUP_SIZE = 5
IMR_D2 = 1.128
MR_D4 = 3.267
CAPABLE_MIN = 1.33  # an index at or above this is "capable"

RULE_NUMBERS = (1, 2, 3, 4, 5, 6, 7, 8)

QUALITY_COLUMNS = ["uts_MPa", "porosity_pct", "dimensional_dev_mm"]
LABELS = {"uts_MPa": "uts", "porosity_pct": "porosity", "dimensional_dev_mm": "dimensional"}
QUARANTINE_COLUMNS = ["uts_MPa", "porosity_pct"]  # dimensional rules are shown but do not quarantine
PARAMETER_COLUMNS = [
    "laser_power_W", "scan_speed_mm_s", "layer_thickness_um", "chamber_oxygen_ppm",
    "humidity_pct", "powder_bed_temp_C", "build_plate_temp_C", "stress_relief_temp_C",
]
REQUIRED_COLUMNS = [
    "build_id", "coupon_id", "build_timestamp", "machine_id", "material_lot",
    "uts_MPa", "yield_MPa", "elongation_pct", "porosity_pct", "dimensional_dev_mm", "pass_fail",
] + PARAMETER_COLUMNS
DEFAULT_SPECS = {
    "uts_MPa": {"lsl": 900.0, "usl": None, "target": 950.0},
    "porosity_pct": {"lsl": None, "usl": 0.5, "target": 0.2},
    "dimensional_dev_mm": {"lsl": -0.10, "usl": 0.10, "target": 0.0},
}
ZERO_VARIATION = "zero within-build variation"


# ---------------------------------------------------------------------------
# Nelson rules
# ---------------------------------------------------------------------------

def nelson(points, cl, sigma):
    """Apply all 8 Nelson rules. Returns {rule_number: [indices where the pattern completes]}.

    z = (x - cl) / sigma. Rules: 1 one point beyond 3 sigma; 2 nine in a row on one side of CL;
    3 six in a row steadily rising or falling; 4 fourteen in a row alternating up and down;
    5 two of three beyond 2 sigma, same side; 6 four of five beyond 1 sigma, same side;
    7 fifteen in a row within 1 sigma; 8 eight in a row beyond 1 sigma (either side, none within).
    For rules 5 and 6 the current point must itself be one of the counted points.
    If sigma is 0 (or not a number) no rule can be judged, so nothing is flagged.
    """
    flags = {k: [] for k in RULE_NUMBERS}
    x = [float(v) for v in points]
    if sigma is None or not sigma > 0:
        return flags
    z = [(v - cl) / sigma for v in x]
    for i in range(len(z)):
        # Rule 1
        if abs(z[i]) > 3:
            flags[1].append(i)
        # Rule 2
        if i >= 8:
            w = z[i - 8:i + 1]
            if all(v > 0 for v in w) or all(v < 0 for v in w):
                flags[2].append(i)
        # Rule 3 (5 strict steps in the same direction = 6 points)
        if i >= 5:
            steps = [x[j + 1] - x[j] for j in range(i - 5, i)]
            if all(s > 0 for s in steps) or all(s < 0 for s in steps):
                flags[3].append(i)
        # Rule 4 (13 steps that alternate in sign = 14 points)
        if i >= 13:
            steps = [x[j + 1] - x[j] for j in range(i - 13, i)]
            if all(steps[j] * steps[j + 1] < 0 for j in range(len(steps) - 1)):
                flags[4].append(i)
        # Rule 5
        if i >= 2:
            w = z[i - 2:i + 1]
            if (z[i] > 2 and sum(v > 2 for v in w) >= 2) or (z[i] < -2 and sum(v < -2 for v in w) >= 2):
                flags[5].append(i)
        # Rule 6
        if i >= 4:
            w = z[i - 4:i + 1]
            if (z[i] > 1 and sum(v > 1 for v in w) >= 4) or (z[i] < -1 and sum(v < -1 for v in w) >= 4):
                flags[6].append(i)
        # Rule 7
        if i >= 14 and all(abs(v) < 1 for v in z[i - 14:i + 1]):
            flags[7].append(i)
        # Rule 8
        if i >= 7 and all(abs(v) > 1 for v in z[i - 7:i + 1]):
            flags[8].append(i)
    return flags


def _any_flag(flags):
    return any(len(v) > 0 for v in flags.values())


# ---------------------------------------------------------------------------
# X-bar and R chart
# ---------------------------------------------------------------------------

def xbar_r(df, subgroup_col, value_col, baseline_n=20):
    """X-bar and R chart for subgroups of exactly 5 values.

    Rows must already be in time order (builds are taken in order of first appearance;
    analyze() sorts by build_timestamp first). Limits use the first `baseline_n` builds, or
    all builds if there are fewer (the result says so).
    """
    for col in (subgroup_col, value_col):
        if col not in df.columns:
            raise ValueError(f"column '{col}' is missing from the data")
    if df[[subgroup_col, value_col]].isna().any().any():
        raise ValueError(f"missing values (NaN) in '{subgroup_col}' or '{value_col}'; fix or remove them")
    if baseline_n < 2:
        raise ValueError("baseline_n must be at least 2")
    groups = df.groupby(subgroup_col, sort=False)[value_col]
    sizes = groups.size()
    bad = sizes[sizes != SUBGROUP_SIZE]
    if len(bad) > 0:
        listing = ", ".join(f"{k} has {v}" for k, v in bad.items())
        raise ValueError(f"each build must have exactly {SUBGROUP_SIZE} coupons; {listing}")
    if len(sizes) < 2:
        raise ValueError("need at least 2 builds to draw a control chart")

    build_ids = [str(k) for k in sizes.index]
    means = [float(v) for v in groups.mean()]
    ranges = [float(groups.max()[k] - groups.min()[k]) for k in sizes.index]

    n_base = min(baseline_n, len(means))
    xbarbar = float(np.mean(means[:n_base]))
    rbar = float(np.mean(ranges[:n_base]))
    sigma_hat = rbar / D2
    sigma_xbar = A2 * rbar / 3  # = sigma_hat / sqrt(5)
    xbar_ucl = xbarbar + A2 * rbar
    xbar_lcl = xbarbar - A2 * rbar
    r_ucl = D4 * rbar
    r_lcl = D3 * rbar

    if len(means) < baseline_n:
        note = f"only {len(means)} builds (fewer than baseline_n={baseline_n}): limits use all {len(means)} builds"
    else:
        note = f"limits use the first {n_base} builds (baseline)"
    message = ZERO_VARIATION + ": Rbar is 0, so sigma-hat is 0 and no run rule can be judged" if rbar == 0 else None

    return {
        "build_ids": build_ids,
        "means": means,
        "ranges": ranges,
        "xbarbar": xbarbar,
        "rbar": rbar,
        "xbar_ucl": xbar_ucl,
        "xbar_lcl": xbar_lcl,
        "r_ucl": r_ucl,
        "r_lcl": r_lcl,
        "sigma_hat": sigma_hat,
        "sigma_xbar": sigma_xbar,
        "xbar_flags": nelson(means, xbarbar, sigma_xbar),
        "r_flags": [i for i, r in enumerate(ranges) if r > r_ucl] if rbar > 0 else [],
        "baseline_n_used": n_base,
        "baseline_note": note,
        "message": message,
    }


# ---------------------------------------------------------------------------
# Capability
# ---------------------------------------------------------------------------

def capability(xbarbar, rbar, lsl=None, usl=None, in_control=True):
    """Process capability using the WITHIN-build sigma-hat = Rbar / d2 (never the overall std).

    Cpl = (mean - LSL) / 3s ; Cpu = (USL - mean) / 3s ; Cp = (USL - LSL) / 6s ;
    Cpk = min(USL - mean, mean - LSL) / 3s (with one spec limit, Cpk is that one side).
    Rbar == 0 gives every index None plus a message (never inf or 0).
    `reliable` = the chart is in control. `capable` = reliable AND Cpk >= 1.33 (None if undefined).
    """
    if lsl is None and usl is None:
        raise ValueError("give at least one specification limit (lsl or usl)")
    if lsl is not None and usl is not None and usl <= lsl:
        raise ValueError("usl must be greater than lsl")
    if rbar < 0:
        raise ValueError("rbar cannot be negative")
    out = {
        "sigma_hat": rbar / D2, "lsl": lsl, "usl": usl, "mean": xbarbar,
        "cpl": None, "cpu": None, "cp": None, "cpk": None,
        "reliable": bool(in_control), "capable": None, "message": None,
    }
    if rbar == 0:
        out["message"] = ZERO_VARIATION + ": capability indices are undefined"
        return out
    s = rbar / D2
    sides = []
    if lsl is not None:
        out["cpl"] = (xbarbar - lsl) / (3 * s)
        sides.append(out["cpl"])
    if usl is not None:
        out["cpu"] = (usl - xbarbar) / (3 * s)
        sides.append(out["cpu"])
    if lsl is not None and usl is not None:
        out["cp"] = (usl - lsl) / (6 * s)
    out["cpk"] = min(sides)
    out["capable"] = bool(in_control and out["cpk"] >= CAPABLE_MIN)
    if not in_control:
        out["message"] = "chart is out of control: indices are printed but not reliable"
    return out


def normality(values, always_warn=None):
    """Shapiro-Wilk test on the baseline coupons. Returns {"p_value", "warning"}.

    `always_warn` is text that is always reported (used for porosity, which is bounded at 0).
    """
    v = np.asarray(values, dtype=float)
    p = None
    warning = None
    if len(v) >= 3 and np.ptp(v) > 0:
        p = float(stats.shapiro(v).pvalue)
        if p < 0.05:
            warning = f"baseline coupons look non-normal (Shapiro-Wilk p = {p:.3g}); indices are approximate"
    if always_warn:
        warning = always_warn if warning is None else warning + "; " + always_warn
    return {"p_value": p, "warning": warning}


# ---------------------------------------------------------------------------
# I-MR chart
# ---------------------------------------------------------------------------

def imr(values, baseline_n=20):
    """Individuals and moving-range chart. Limits from the first `baseline_n` values.

    `mr_flags` holds the index of the LATER point of each moving range above the MR UCL.
    Rules 1-8 apply to the I chart; the MR chart uses rule 1 only.
    """
    x = [float(v) for v in values]
    if len(x) < 2:
        raise ValueError("an I-MR chart needs at least 2 values")
    if any(math.isnan(v) for v in x):
        raise ValueError("missing values (NaN) in the I-MR input")
    if baseline_n < 2:
        raise ValueError("baseline_n must be at least 2")
    n_base = min(baseline_n, len(x))
    base = x[:n_base]
    mrs_all = [abs(x[i + 1] - x[i]) for i in range(len(x) - 1)]
    mr_bar = float(np.mean([abs(base[i + 1] - base[i]) for i in range(n_base - 1)]))
    cl = float(np.mean(base))
    sigma = mr_bar / IMR_D2
    res = {
        "points": x, "moving_ranges": mrs_all, "cl": cl, "mr_bar": mr_bar, "sigma": sigma,
        "ucl": None, "lcl": None, "mr_ucl": None,
        "flags": nelson(x, cl, sigma), "mr_flags": [],
        "baseline_n_used": n_base, "message": None,
    }
    if sigma == 0:
        res["message"] = "baseline has no variation (MRbar = 0): limits and run rules cannot be judged"
        return res
    res["ucl"] = cl + 3 * sigma
    res["lcl"] = cl - 3 * sigma
    res["mr_ucl"] = MR_D4 * mr_bar
    res["mr_flags"] = [i + 1 for i, m in enumerate(mrs_all) if m > res["mr_ucl"]]
    return res


# ---------------------------------------------------------------------------
# Disposition and parameter ranking
# ---------------------------------------------------------------------------

def disposition(rules_broken, any_out_of_spec):
    """One verdict per build.

    rules_broken: per build, a list of rule descriptions on the UTS/porosity X-bar or R charts.
    any_out_of_spec: per build, True if any coupon is outside a spec limit.
    QUARANTINE if a rule fired; else RETEST if a coupon is out of spec; else RELEASE.
    """
    if len(rules_broken) != len(any_out_of_spec):
        raise ValueError("rules_broken and any_out_of_spec must have the same length")
    out = []
    for rules, bad in zip(rules_broken, any_out_of_spec):
        if len(rules) > 0:
            out.append("QUARANTINE")
        elif bad:
            out.append("RETEST")
        else:
            out.append("RELEASE")
    return out


def rank_parameters(params_df, baseline_n=20):
    """I-chart each build parameter and rank the drifting ones, per build.

    params_df: one row per build (time order), columns = build parameters.
    Returns {"charts": {name: imr result}, "ranking": {build_index: [...]}, "skipped": {name: why}}.
    ranking[i] lists {"parameter", "z", "rules"} for parameters with a rule firing at build i,
    largest |z| = |x - CL| / sigma first. Parameters with zero baseline sigma are skipped.
    """
    charts, skipped, ranking = {}, {}, {}
    for name in PARAMETER_COLUMNS:
        if name not in params_df.columns:
            continue
        res = imr(params_df[name].tolist(), baseline_n)
        if res["sigma"] == 0:
            skipped[name] = "zero baseline sigma (the parameter did not vary in the baseline): skipped"
            continue
        charts[name] = res
        for i, x in enumerate(res["points"]):
            fired = [k for k in RULE_NUMBERS if i in res["flags"][k]]
            if fired:
                z = (x - res["cl"]) / res["sigma"]
                ranking.setdefault(i, []).append({"parameter": name, "z": z, "rules": fired})
    for i in ranking:
        ranking[i].sort(key=lambda d: abs(d["z"]), reverse=True)
    return {"charts": charts, "ranking": ranking, "skipped": skipped}


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def _clean(obj):
    """Turn numpy/pandas values into plain JSON-safe Python (NaN and inf become None)."""
    if isinstance(obj, dict):
        return {str(k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, np.ndarray)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return f if math.isfinite(f) else None
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    return obj


def _merge_specs(specs):
    merged = {k: dict(v) for k, v in DEFAULT_SPECS.items()}
    for col, given in (specs or {}).items():
        if col not in merged:
            raise ValueError(f"unknown spec column '{col}'; use one of {list(merged)}")
        merged[col].update(given)
    return merged


def analyze(df, specs=None, baseline_n=20):
    """Run every statistic on a coupon-level DataFrame and return a JSON-safe dict.

    df: one row per coupon with the REQUIRED_COLUMNS (SPEC section 3).
    specs: optional {"uts_MPa": {"lsl": ..}, ...} overriding the defaults.
    """
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing required columns: {', '.join(missing)}")
    nan_cols = [c for c in REQUIRED_COLUMNS if df[c].isna().any()]
    if nan_cols:
        raise ValueError(f"missing values (NaN) in columns: {', '.join(nan_cols)}")
    specs = _merge_specs(specs)
    warnings = []

    # Time order: builds sorted by their earliest timestamp (stable for ties).
    data = df.copy()
    try:
        data["_ts"] = pd.to_datetime(data["build_timestamp"])
    except (ValueError, TypeError) as err:
        raise ValueError(f"build_timestamp is not a valid date/time: {err}")
    data["build_id"] = data["build_id"].astype(str)
    build_time = data.groupby("build_id", sort=False)["_ts"].min().sort_values(kind="stable")
    order = {b: i for i, b in enumerate(build_time.index)}
    data["_order"] = data["build_id"].map(order)
    data = data.sort_values("_order", kind="stable").reset_index(drop=True)
    build_ids = list(build_time.index)
    timestamps = [t.isoformat() for t in build_time]

    # Quality characteristics: X-bar / R chart, capability, normality.
    charts, capabilities = {}, {}
    rules_by_build = {i: [] for i in range(len(build_ids))}      # all charts (for the table)
    quarantine_rules = {i: [] for i in range(len(build_ids))}    # UTS / porosity only
    first_bad = []
    all_in_control = True
    all_capable = True
    n_base = None
    for col in QUALITY_COLUMNS:
        res = xbar_r(data, "build_id", col, baseline_n)
        n_base = res["baseline_n_used"]
        label = LABELS[col]
        found = []
        for k in RULE_NUMBERS:
            for i in res["xbar_flags"][k]:
                found.append((i, f"{label} X-bar rule {k}"))
        for i in res["r_flags"]:
            found.append((i, f"{label} R rule 1"))
        for i, text in found:
            rules_by_build[i].append(text)
            if col in QUARANTINE_COLUMNS:
                quarantine_rules[i].append(text)
        if found:
            first_bad.append(min(i for i, _ in found))
        in_control = not found
        spec = specs[col]
        cap = capability(res["xbarbar"], res["rbar"], spec["lsl"], spec["usl"], in_control)
        base_values = data[data["build_id"].isin(build_ids[:n_base])][col]
        approx = "porosity is bounded at 0 and skewed, so Cpu is approximate" if col == "porosity_pct" else None
        norm = normality(base_values, approx)
        cap["normality_p"] = norm["p_value"]
        cap["normality_warning"] = norm["warning"]
        cap["target"] = spec["target"]
        capabilities[col] = cap
        if norm["warning"]:
            warnings.append(f"{col}: {norm['warning']}")
        if res["message"]:
            warnings.append(f"{col}: {res['message']}")
        if cap["message"] and not res["message"]:
            warnings.append(f"{col}: {cap['message']}")
        if res["baseline_note"] and res["baseline_n_used"] < baseline_n:
            warnings.append(f"{col}: {res['baseline_note']}")
        all_in_control = all_in_control and in_control
        all_capable = all_capable and cap["capable"] is True
        charts[col] = {
            "build_ids": build_ids,
            "xbar": {"cl": res["xbarbar"], "ucl": res["xbar_ucl"], "lcl": res["xbar_lcl"],
                     "sigma": res["sigma_xbar"], "points": res["means"], "flags": res["xbar_flags"]},
            "r": {"cl": res["rbar"], "ucl": res["r_ucl"], "lcl": res["r_lcl"],
                  "points": res["ranges"], "flags": res["r_flags"]},
            "sigma_hat": res["sigma_hat"], "baseline_n_used": res["baseline_n_used"],
            "baseline_note": res["baseline_note"], "message": res["message"],
        }

    # Build parameters: one value per build, I-MR charts, ranking.
    params_df = data.groupby("build_id", sort=False)[PARAMETER_COLUMNS].first().loc[build_ids].reset_index(drop=True)
    ranked = rank_parameters(params_df, baseline_n)
    charts["imr"] = ranked["charts"]
    for name, why in ranked["skipped"].items():
        warnings.append(f"{name}: {why}")
    for name, res in ranked["charts"].items():
        if res["message"]:
            warnings.append(f"{name}: {res['message']}")

    # Per-build out-of-spec check and table.
    bad_coupon = pd.Series(False, index=data.index)
    for col in QUALITY_COLUMNS:
        s = specs[col]
        if s["lsl"] is not None:
            bad_coupon |= data[col] < s["lsl"]
        if s["usl"] is not None:
            bad_coupon |= data[col] > s["usl"]
    bad_by_build = bad_coupon.groupby(data["build_id"], sort=False).any()
    out_of_spec = [bool(bad_by_build[b]) for b in build_ids]
    verdicts = disposition([quarantine_rules[i] for i in range(len(build_ids))], out_of_spec)
    builds = []
    for i, b in enumerate(build_ids):
        builds.append({
            "build_id": b,
            "timestamp": timestamps[i],
            "disposition": verdicts[i],
            "any_coupon_out_of_spec": out_of_spec[i],
            "rules_broken": rules_by_build[i],
            "investigate_first": ranked["ranking"].get(i, []) if rules_by_build[i] else [],
        })

    first_idx = min(first_bad) if first_bad else None
    if not all_in_control:
        warnings.append("a chart is out of control: capability indices are printed but not reliable")
    result = {
        "build_ids": build_ids,
        "charts": charts,
        "capability": capabilities,
        "process_capable": bool(all_in_control and all_capable),
        "first_out_of_control_build": build_ids[first_idx] if first_idx is not None else None,
        "builds": builds,
        "warnings": warnings,
        "settings": {
            "baseline_n": baseline_n, "baseline_n_used": n_base, "subgroup_size": SUBGROUP_SIZE,
            "specs": specs, "capable_min_index": CAPABLE_MIN,
            "constants": {"A2": A2, "D3": D3, "D4": D4, "d2": D2, "imr_d2": IMR_D2, "mr_D4": MR_D4},
        },
    }
    return _clean(result)

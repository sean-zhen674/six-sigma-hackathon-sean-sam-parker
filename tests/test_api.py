"""Tests for the AeroPrint REST API (task H-04). No server needed: TestClient calls the app directly.

The API holds no statistics. These tests check that the routes hand the right data to
app.qc.analyze() and return its numbers unchanged.
"""
import io
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
client = TestClient(app)


def post_csv(content: bytes, **params):
    return client.post("/analyze", files={"file": ("upload.csv", content, "text/csv")}, params=params)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_root_links_to_docs():
    body = client.get("/").json()
    assert body["docs"] == "/docs"


def test_datasets_lists_three():
    r = client.get("/datasets")
    assert r.status_code == 200
    names = [d["name"] for d in r.json()["datasets"]]
    assert sorted(names) == ["capable_baseline", "laser_power_excursion", "oxygen_drift"]
    assert all(d["description"] for d in r.json()["datasets"])


def test_spec_limits_are_the_defaults():
    r = client.get("/spec-limits")
    assert r.status_code == 200
    specs = r.json()["specs"]
    assert specs["uts_MPa"]["lsl"] == 900.0
    assert specs["porosity_pct"]["usl"] == 0.5
    assert specs["dimensional_dev_mm"]["lsl"] == -0.10


def test_capable_baseline_is_capable_and_all_release():
    body = client.get("/analyze/capable_baseline").json()
    assert body["process_capable"] is True
    assert len(body["builds"]) == 30
    assert {b["disposition"] for b in body["builds"]} == {"RELEASE"}


def test_oxygen_drift_points_at_oxygen():
    body = client.get("/analyze/oxygen_drift").json()
    assert body["first_out_of_control_build"] == "B-1023"
    build = next(b for b in body["builds"] if b["build_id"] == "B-1023")
    assert build["investigate_first"][0]["parameter"] == "chamber_oxygen_ppm"


def test_laser_power_excursion_points_at_laser_power():
    body = client.get("/analyze/laser_power_excursion").json()
    build = next(b for b in body["builds"] if b["build_id"] == "B-1024")
    assert build["investigate_first"][0]["parameter"] == "laser_power_W"


def test_unknown_dataset_is_404_with_message():
    r = client.get("/analyze/not_a_dataset")
    assert r.status_code == 404
    assert "not_a_dataset" in r.json()["detail"]


def test_dataset_name_cannot_escape_the_data_folder():
    r = client.get("/analyze/..%2FREADME")
    assert r.status_code == 404


def test_upload_equals_bundled_dataset():
    content = (DATA / "capable_baseline.csv").read_bytes()
    uploaded = post_csv(content)
    assert uploaded.status_code == 200
    assert uploaded.json() == client.get("/analyze/capable_baseline").json()


def test_spec_override_changes_the_specs_used():
    content = (DATA / "capable_baseline.csv").read_bytes()
    body = post_csv(content, uts_lsl=930, porosity_usl=0.4, dim_lsl=-0.2, dim_usl=0.2).json()
    specs = body["settings"]["specs"]
    assert specs["uts_MPa"]["lsl"] == 930
    assert specs["porosity_pct"]["usl"] == 0.4
    assert specs["dimensional_dev_mm"]["lsl"] == -0.2
    assert specs["dimensional_dev_mm"]["usl"] == 0.2


def test_baseline_n_below_5_is_rejected():
    content = (DATA / "capable_baseline.csv").read_bytes()
    assert post_csv(content, baseline_n=3).status_code == 422


def test_missing_column_is_422_and_names_it():
    df = pd.read_csv(DATA / "capable_baseline.csv").drop(columns=["uts_MPa"])
    r = post_csv(df.to_csv(index=False).encode())
    assert r.status_code == 422
    assert "missing required columns" in r.json()["detail"]
    assert "uts_MPa" in r.json()["detail"]


def test_build_with_four_coupons_is_422():
    df = pd.read_csv(DATA / "capable_baseline.csv")
    df = df.drop(index=df.index[0])  # first build now has 4 coupons
    r = post_csv(df.to_csv(index=False).encode())
    assert r.status_code == 422
    assert "5" in r.json()["detail"]


@pytest.mark.parametrize("junk", [b"\x00\xff\xfe\x80\x81garbage\x00", b"", b"not,a\nreal one"])
def test_garbage_upload_is_422_not_500(junk):
    r = post_csv(junk)
    assert r.status_code == 422
    assert r.json()["detail"]


def test_known_answer_through_the_api():
    """SPEC section 4: 3 builds of 5 UTS coupons. Hand-calculated numbers, read from the JSON."""
    uts = {
        "B1": [945, 952, 950, 948, 955],
        "B2": [951, 953, 955, 957, 959],
        "B3": [939, 951, 945, 947, 943],
    }
    rows = []
    for i, (build, values) in enumerate(uts.items()):
        for j, value in enumerate(values):
            rows.append({
                "build_id": build, "coupon_id": f"{build}-{j}",
                "build_timestamp": f"2026-01-0{i + 1}T08:00:00",
                "machine_id": "AM-01", "material_lot": "LOT-1",
                "uts_MPa": value, "yield_MPa": 880.0, "elongation_pct": 10.0,
                # small variation so porosity and dimensional are not degenerate
                "porosity_pct": 0.2 + 0.01 * j, "dimensional_dev_mm": 0.01 * j,
                "pass_fail": True,
                "laser_power_W": 280.0 + i, "scan_speed_mm_s": 1200.0 + i,
                "layer_thickness_um": 30.0 + i, "chamber_oxygen_ppm": 100.0 + 10 * i,
                "humidity_pct": 35.0 + i, "powder_bed_temp_C": 180.0 + i,
                "build_plate_temp_C": 198.0 + i, "stress_relief_temp_C": 650.0 + i,
            })
    csv_bytes = pd.DataFrame(rows).to_csv(index=False).encode()
    r = post_csv(csv_bytes)
    assert r.status_code == 200, r.text
    uts_chart = r.json()["charts"]["uts_MPa"]
    assert uts_chart["xbar"]["cl"] == pytest.approx(950.0)
    assert uts_chart["xbar"]["ucl"] == pytest.approx(955.77)
    assert uts_chart["xbar"]["lcl"] == pytest.approx(944.23)
    assert uts_chart["r"]["cl"] == pytest.approx(10.0)
    assert uts_chart["r"]["ucl"] == pytest.approx(21.14)
    assert uts_chart["r"]["lcl"] == 0
    assert uts_chart["sigma_hat"] == pytest.approx(4.2992, abs=1e-4)
    assert r.json()["capability"]["uts_MPa"]["cpl"] == pytest.approx(3.877, abs=1e-3)


def test_imports_work_inside_a_bundle(tmp_path):
    """Posit Connect uses app/ as the bundle root, so the package `app` does not exist there.
    Copy main.py, qc.py and the data into a bare folder and import `main` from inside it."""
    bundle = tmp_path / "bundle"
    (bundle / "data").mkdir(parents=True)
    shutil.copy(ROOT / "app" / "main.py", bundle)
    shutil.copy(ROOT / "app" / "qc.py", bundle)
    for csv in DATA.glob("*.csv"):
        shutil.copy(csv, bundle / "data")
    code = (
        "import main\n"
        "from fastapi.testclient import TestClient\n"
        "c = TestClient(main.app)\n"
        "assert main.analyze.__module__ == 'qc', main.analyze.__module__\n"
        "assert len(c.get('/datasets').json()['datasets']) == 3\n"
        "assert c.get('/analyze/capable_baseline').json()['process_capable'] is True\n"
        "print('bundle ok')\n"
    )
    out = subprocess.run([sys.executable, "-c", code], cwd=bundle, capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    assert "bundle ok" in out.stdout


# ---- H-09: GET /analyze/{dataset} takes the same spec parameters as POST /analyze ----

def test_get_with_uts_lsl_equals_post_with_uts_lsl():
    content = (DATA / "oxygen_drift.csv").read_bytes()
    got = client.get("/analyze/oxygen_drift", params={"uts_lsl": 990})
    posted = post_csv(content, uts_lsl=990)
    assert got.status_code == 200
    assert got.json() == posted.json()
    assert got.json()["capability"]["uts_MPa"]["cpl"] == pytest.approx(-1.04, abs=0.005)


def test_get_with_all_spec_parameters_equals_post():
    content = (DATA / "laser_power_excursion.csv").read_bytes()
    params = {"baseline_n": 15, "uts_lsl": 920, "porosity_usl": 0.4, "dim_lsl": -0.2, "dim_usl": 0.2}
    assert client.get("/analyze/laser_power_excursion", params=params).json() == post_csv(content, **params).json()


def test_get_without_spec_parameters_keeps_the_defaults():
    body = client.get("/analyze/oxygen_drift").json()
    assert body["settings"]["specs"]["uts_MPa"]["lsl"] == 900.0
    assert body["capability"]["uts_MPa"]["cpl"] == pytest.approx(4.64, abs=0.005)


@pytest.mark.parametrize("method", ["get", "post"])
def test_dim_lsl_not_below_dim_usl_is_422_with_a_message(method):
    params = {"dim_lsl": 0.2, "dim_usl": 0.1}
    if method == "get":
        r = client.get("/analyze/oxygen_drift", params=params)
    else:
        r = post_csv((DATA / "oxygen_drift.csv").read_bytes(), **params)
    assert r.status_code == 422
    assert "usl must be greater than lsl" in r.json()["detail"]


def test_get_with_baseline_n_3_is_422():
    assert client.get("/analyze/oxygen_drift", params={"baseline_n": 3}).status_code == 422


@pytest.mark.parametrize("bad", ["nan", "inf", "-inf"])
def test_non_finite_spec_limit_is_422(bad):
    r = client.get("/analyze/oxygen_drift", params={"uts_lsl": bad})
    assert r.status_code == 422
    assert "uts_lsl" in str(r.json()["detail"])


# ---- H-10: minimal upload format ----

TEMPLATES = ROOT / "data" / "template"


def test_minimal_template_upload_gives_the_known_answer():
    r = post_csv((TEMPLATES / "aeroprint_template.csv").read_bytes())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["capability"]["uts_MPa"]["cpl"] == pytest.approx(3.877, abs=0.0005)
    assert body["charts"]["uts_MPa"]["xbar"]["cl"] == pytest.approx(950.0)
    assert body["charts"]["imr"] == {}
    assert body["settings"]["parameters_used"] == []
    assert len(body["settings"]["parameters_missing"]) == 8
    assert any("No print-parameter columns found" in w for w in body["warnings"])


def test_template_with_parameters_upload_uses_all_eight():
    r = post_csv((TEMPLATES / "aeroprint_template_with_parameters.csv").read_bytes())
    assert r.status_code == 200, r.text
    assert len(r.json()["settings"]["parameters_used"]) == 8
    assert len(r.json()["charts"]["imr"]) == 8


def test_five_column_upload_of_a_sample_dataset_is_200_and_ignores_extras():
    df = pd.read_csv(DATA / "oxygen_drift.csv")
    five = df[["build_id", "build_timestamp", "uts_MPa", "porosity_pct", "dimensional_dev_mm"]]
    r = post_csv(five.to_csv(index=False).encode())
    assert r.status_code == 200
    full = client.get("/analyze/oxygen_drift").json()
    assert r.json()["charts"]["uts_MPa"] == full["charts"]["uts_MPa"]
    df.loc[0, "yield_MPa"] = None  # a blank in an ignored column
    assert post_csv(df.to_csv(index=False).encode()).status_code == 200


def _bad_upload(mutate):
    df = mutate(pd.read_csv(TEMPLATES / "aeroprint_template.csv"))
    r = post_csv(df.to_csv(index=False).encode())
    assert r.status_code == 422
    return r.json()["detail"]


def test_bad_files_are_422_with_the_specific_text():
    assert "missing required columns: porosity_pct" in _bad_upload(lambda d: d.drop(columns=["porosity_pct"]))
    assert "build B-0002 has 4 coupons; each build needs exactly 5" in _bad_upload(lambda d: d.drop(index=7))

    def text(d):
        d["uts_MPa"] = d["uts_MPa"].astype(object)
        d.loc[2, "uts_MPa"] = "abc"
        return d
    assert "column 'uts_MPa' has non-numeric text, for example 'abc'" in _bad_upload(text)

    def blank(d):
        d.loc[2, "porosity_pct"] = None
        return d
    assert "column 'porosity_pct' has 1 blank or missing values" in _bad_upload(blank)

    def stamp(d):
        d["build_timestamp"] = d["build_timestamp"].astype(object)
        d.loc[0, "build_timestamp"] = "not a date"
        return d
    assert "build_timestamp is not a valid date/time" in _bad_upload(stamp)


# ---- H-10 review fixes: odd data is a 422 with a message, never a 500 ----

def _upload_df(df):
    return post_csv(df.to_csv(index=False).encode())


def test_true_false_column_is_422_through_the_api():
    df = pd.read_csv(TEMPLATES / "aeroprint_template.csv")
    df["uts_MPa"] = [True, False] * 7 + [True]
    r = _upload_df(df)
    assert r.status_code == 422
    assert "contains True/False values; it must contain numbers" in r.json()["detail"]


def test_infinite_value_is_422_through_the_api():
    r = post_csv(b"build_id,build_timestamp,uts_MPa,porosity_pct,dimensional_dev_mm\n"
                 b"A,2026-01-01,inf,0.2,0.01\n")
    assert r.status_code == 422
    assert "infinite value (row 2 of the file)" in r.json()["detail"]
    df = pd.read_csv(TEMPLATES / "aeroprint_template.csv").astype({"uts_MPa": float})
    df.loc[6, "uts_MPa"] = float("inf")
    r = _upload_df(df)
    assert r.status_code == 422 and "row 8 of the file" in r.json()["detail"]


def test_header_only_file_is_422_through_the_api():
    r = post_csv(b"build_id,build_timestamp,uts_MPa,porosity_pct,dimensional_dev_mm\n")
    assert r.status_code == 422
    assert "the file has a header but no data rows" in r.json()["detail"]


def test_shared_timestamps_are_a_warning_not_an_error_through_the_api():
    df = pd.read_csv(TEMPLATES / "aeroprint_template.csv")
    df.loc[df["build_id"] == "B-0002", "build_timestamp"] = df["build_timestamp"].iloc[0]
    r = _upload_df(df)
    assert r.status_code == 200
    assert any("2 builds share the same build_timestamp (for example B-0001 and B-0002)" in w
               for w in r.json()["warnings"])

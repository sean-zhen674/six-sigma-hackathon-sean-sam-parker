"""The deployed bundle is the app/ folder only, so app/data/ must be an exact copy of data/."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_app_data_is_an_exact_copy_of_data():
    sources = sorted((ROOT / "data").glob("*.csv"))
    assert len(sources) == 3
    for src in sources:
        copy = ROOT / "app" / "data" / src.name
        assert copy.is_file(), f"missing {copy}; run: bash app/manifestme.sh"
        assert copy.read_bytes() == src.read_bytes(), f"{copy} differs from {src}; run: bash app/manifestme.sh"

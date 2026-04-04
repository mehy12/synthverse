from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd

from odisha_feature_builder import REQUIRED_FEATURES, _canonicalize_columns


ODISHA_COASTAL_DISTRICTS = {
    "Balasore",
    "Bhadrak",
    "Jagatsinghpur",
    "Kendrapara",
    "Puri",
    "Ganjam",
}


def _ensure_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    if "district" in out.columns:
        out["district"] = out["district"].astype(str).str.strip().str.title()

    if "coastal_exposure" not in out.columns:
        if "district" in out.columns:
            out["coastal_exposure"] = out["district"].isin(ODISHA_COASTAL_DISTRICTS).astype(int)
        else:
            out["coastal_exposure"] = 0

    if "seasonal_rise_m" not in out.columns:
        if "pre_monsoon_water_table_m_bgl" in out.columns and "post_monsoon_water_table_m_bgl" in out.columns:
            pre = pd.to_numeric(out["pre_monsoon_water_table_m_bgl"], errors="coerce")
            post = pd.to_numeric(out["post_monsoon_water_table_m_bgl"], errors="coerce")
            out["seasonal_rise_m"] = (pre - post).clip(lower=0.1)
        else:
            out["seasonal_rise_m"] = 1.0

    # Conservative defaults for still-missing columns
    defaults = {
        "water_bodies_count": 90888,
        "pre_monsoon_water_table_m_bgl": 5.0,
        "post_monsoon_water_table_m_bgl": 3.0,
        "monsoon_rainfall_mm": 1400,
        "river_proximity_km": 4.0,
        "urban_drainage_stress": 0.55,
        "wetland_buffer_index": 0.45,
    }

    for col, value in defaults.items():
        if col not in out.columns:
            out[col] = value

    return out

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = ROOT / "scripts" / "ml" / "artifacts"
DEFAULT_MODEL_FILE = ARTIFACTS_DIR / "odisha_flood_model.joblib"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict Odisha flood risk from a CSV file")
    parser.add_argument("--input-csv", type=Path, required=True)
    parser.add_argument("--output-csv", type=Path, default=ROOT / "scripts" / "ml" / "data" / "odisha_predictions.csv")
    parser.add_argument("--model-file", type=Path, default=DEFAULT_MODEL_FILE)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.model_file.exists():
        raise FileNotFoundError(f"Model file not found: {args.model_file}")
    if not args.input_csv.exists():
        raise FileNotFoundError(f"Input CSV not found: {args.input_csv}")

    model = joblib.load(args.model_file)
    df = pd.read_csv(args.input_csv)
    df = _canonicalize_columns(df)
    df = _ensure_features(df)

    missing = [col for col in REQUIRED_FEATURES if col not in df.columns]
    if missing:
        raise ValueError(
            "Input CSV is missing required feature columns: " + ", ".join(missing)
        )

    x = df[REQUIRED_FEATURES].copy()
    for col in REQUIRED_FEATURES:
        x[col] = pd.to_numeric(x[col], errors="coerce")

    if x.isna().any().any():
        x = x.fillna(x.median(numeric_only=True))

    df["predicted_flood_risk_score"] = model.predict(x).round(2)

    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.output_csv, index=False)

    print(f"Predictions written to {args.output_csv}")


if __name__ == "__main__":
    main()

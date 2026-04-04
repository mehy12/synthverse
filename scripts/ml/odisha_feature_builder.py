from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATASETS_DIR = ROOT / "datasets"
ML_DATA_DIR = ROOT / "scripts" / "ml" / "data"

DEFAULT_ODISHA_CSV = DATASETS_DIR / "odisha_dataset.csv"
DEFAULT_STATE_DISTRIBUTION_CSV = DATASETS_DIR / "state-wise-distribution.csv"

ODISHA_DISTRICT_META = {
    "Angul": {"lat": 20.84, "lon": 85.10, "coastal": 0},
    "Balangir": {"lat": 20.71, "lon": 83.49, "coastal": 0},
    "Balasore": {"lat": 21.49, "lon": 86.93, "coastal": 1},
    "Bargarh": {"lat": 21.33, "lon": 83.62, "coastal": 0},
    "Bhadrak": {"lat": 21.06, "lon": 86.50, "coastal": 1},
    "Boudh": {"lat": 20.84, "lon": 84.32, "coastal": 0},
    "Cuttack": {"lat": 20.46, "lon": 85.88, "coastal": 0},
    "Deogarh": {"lat": 21.54, "lon": 84.73, "coastal": 0},
    "Dhenkanal": {"lat": 20.66, "lon": 85.60, "coastal": 0},
    "Gajapati": {"lat": 19.16, "lon": 84.16, "coastal": 0},
    "Ganjam": {"lat": 19.31, "lon": 84.79, "coastal": 1},
    "Jagatsinghpur": {"lat": 20.26, "lon": 86.17, "coastal": 1},
    "Jajpur": {"lat": 20.85, "lon": 86.34, "coastal": 0},
    "Jharsuguda": {"lat": 21.85, "lon": 84.02, "coastal": 0},
    "Kalahandi": {"lat": 19.91, "lon": 83.17, "coastal": 0},
    "Kandhamal": {"lat": 20.47, "lon": 84.23, "coastal": 0},
    "Kendrapara": {"lat": 20.50, "lon": 86.42, "coastal": 1},
    "Kendujhar": {"lat": 21.63, "lon": 85.58, "coastal": 0},
    "Khordha": {"lat": 20.18, "lon": 85.62, "coastal": 0},
    "Koraput": {"lat": 18.81, "lon": 82.71, "coastal": 0},
    "Malkangiri": {"lat": 18.35, "lon": 81.89, "coastal": 0},
    "Mayurbhanj": {"lat": 21.94, "lon": 86.73, "coastal": 0},
    "Nabarangpur": {"lat": 19.24, "lon": 82.55, "coastal": 0},
    "Nayagarh": {"lat": 20.13, "lon": 85.09, "coastal": 0},
    "Nuapada": {"lat": 20.80, "lon": 82.53, "coastal": 0},
    "Puri": {"lat": 19.81, "lon": 85.83, "coastal": 1},
    "Rayagada": {"lat": 19.17, "lon": 83.42, "coastal": 0},
    "Sambalpur": {"lat": 21.47, "lon": 83.97, "coastal": 0},
    "Subarnapur": {"lat": 20.84, "lon": 83.90, "coastal": 0},
    "Sundargarh": {"lat": 22.12, "lon": 84.03, "coastal": 0},
}

COLUMN_ALIASES: Dict[str, Iterable[str]] = {
    "state": ["state", "province", "region"],
    "district": ["district", "district_name", "districtname", "area", "location"],
    "latitude": ["latitude", "lat", "y"],
    "longitude": ["longitude", "lon", "lng", "x"],
    "water_bodies_count": ["water_bodies_count", "water bodies count", "water_bodies", "waterbody_count"],
    "monsoon_rainfall_mm": ["monsoon_rainfall_mm", "rainfall_mm", "annual_rainfall_mm", "rain_mm"],
    "pre_monsoon_water_table_m_bgl": [
        "pre_monsoon_water_table_m_bgl",
        "pre_monsoon_depth",
        "pre_water_table",
        "pre_monsoon_wt",
    ],
    "post_monsoon_water_table_m_bgl": [
        "post_monsoon_water_table_m_bgl",
        "post_monsoon_depth",
        "post_water_table",
        "post_monsoon_wt",
    ],
    "river_proximity_km": ["river_proximity_km", "distance_to_river_km", "river_distance_km"],
    "urban_drainage_stress": ["urban_drainage_stress", "drainage_stress", "urban_stress"],
    "wetland_buffer_index": ["wetland_buffer_index", "wetland_index", "wetland_buffer"],
    "flood_risk_score": ["flood_risk_score", "risk_score", "target", "flood_score"],
}

REQUIRED_FEATURES = [
    "water_bodies_count",
    "coastal_exposure",
    "pre_monsoon_water_table_m_bgl",
    "post_monsoon_water_table_m_bgl",
    "seasonal_rise_m",
    "monsoon_rainfall_mm",
    "river_proximity_km",
    "urban_drainage_stress",
    "wetland_buffer_index",
]


@dataclass
class BuildConfig:
    seed: int = 42
    output_dummy_csv: Path = ML_DATA_DIR / "odisha_water_tables_dummy.csv"
    output_training_csv: Path = ML_DATA_DIR / "odisha_training_dataset.csv"


def _canonicalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map: Dict[str, str] = {}
    normalized = {str(col).strip().lower(): col for col in df.columns}

    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias.lower() in normalized:
                rename_map[normalized[alias.lower()]] = canonical
                break

    return df.rename(columns=rename_map).copy()


def _safe_numeric(df: pd.DataFrame, column: str) -> None:
    if column in df.columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")


def build_dummy_odisha_water_tables(seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []

    for district, meta in ODISHA_DISTRICT_META.items():
        coastal = int(meta["coastal"])

        pre_depth = float(rng.uniform(1.4, 8.8) - (0.6 if coastal else 0.0))
        pre_depth = max(0.5, pre_depth)

        rise = float(rng.uniform(0.5, 2.9) + (0.35 if coastal else 0.0))
        post_depth = max(0.2, pre_depth - rise)

        rainfall = float(rng.uniform(980, 1850) + (180 if coastal else 0))
        river_proximity = float(rng.uniform(0.2, 16.0) - (0.3 if coastal else 0))
        river_proximity = max(0.1, river_proximity)

        rows.append(
            {
                "state": "Odisha",
                "district": district,
                "latitude": meta["lat"],
                "longitude": meta["lon"],
                "coastal_exposure": coastal,
                "pre_monsoon_water_table_m_bgl": round(pre_depth, 2),
                "post_monsoon_water_table_m_bgl": round(post_depth, 2),
                "seasonal_rise_m": round(pre_depth - post_depth, 2),
                "monsoon_rainfall_mm": round(rainfall, 1),
                "river_proximity_km": round(river_proximity, 2),
                "urban_drainage_stress": round(float(rng.uniform(0.24, 0.95)), 3),
                "wetland_buffer_index": round(float(rng.uniform(0.12, 0.91)), 3),
            }
        )

    return pd.DataFrame(rows)


def _synthesize_target(df: pd.DataFrame, seed: int = 42) -> pd.Series:
    rng = np.random.default_rng(seed)
    raw = (
        0.00024 * df["water_bodies_count"]
        + 0.016 * df["monsoon_rainfall_mm"]
        + 8.2 * df["coastal_exposure"]
        + 5.1 * df["urban_drainage_stress"]
        + 4.2 * df["seasonal_rise_m"]
        + 3.0 * (1.0 / (df["river_proximity_km"] + 0.45))
        - 2.0 * df["wetland_buffer_index"]
        + rng.normal(0.0, 2.0, size=len(df))
    )
    return raw.clip(5, 99).round(2)


def _load_state_distribution(path: Path) -> pd.DataFrame:
    state_df = pd.read_csv(path)

    # Handle quoted/exported headers like "Category" and "Water Bodies Count"
    state_df.columns = [str(col).strip().strip('"') for col in state_df.columns]

    state_df = _canonicalize_columns(state_df)

    if "state" not in state_df.columns:
        for col in state_df.columns:
            if str(col).strip().lower() in {"category", "categories"}:
                state_df = state_df.rename(columns={col: "state"})
                break

    if "water_bodies_count" not in state_df.columns:
        for col in state_df.columns:
            cleaned = str(col).strip().lower().replace("_", " ")
            if cleaned in {"water bodies count", "waterbody count"}:
                state_df = state_df.rename(columns={col: "water_bodies_count"})
                break

    if "state" not in state_df.columns or "water_bodies_count" not in state_df.columns:
        raise ValueError("state-wise-distribution.csv must include state and water_bodies_count columns")

    state_df["state"] = state_df["state"].astype(str).str.strip().str.replace('"', "", regex=False)
    _safe_numeric(state_df, "water_bodies_count")
    state_df = state_df.dropna(subset=["state", "water_bodies_count"])
    state_df = state_df[state_df["state"].str.contains(r"[A-Za-z]", regex=True, na=False)]
    return state_df[["state", "water_bodies_count"]].reset_index(drop=True)


def _guess_water_bodies_for_odisha(state_df: pd.DataFrame) -> float:
    row = state_df[state_df["state"].str.lower().eq("odisha")]
    if row.empty:
        return float(state_df["water_bodies_count"].median())
    return float(row.iloc[0]["water_bodies_count"])


def _clean_odisha_rows(df: pd.DataFrame) -> pd.DataFrame:
    df = _canonicalize_columns(df)

    if "state" in df.columns:
        mask = df["state"].astype(str).str.lower().str.contains("odisha")
        if mask.any():
            df = df[mask].copy()

    if "district" in df.columns:
        df["district"] = df["district"].astype(str).str.strip().str.title()
    else:
        df["district"] = np.random.choice(list(ODISHA_DISTRICT_META.keys()), size=len(df))

    for col in [
        "latitude",
        "longitude",
        "water_bodies_count",
        "monsoon_rainfall_mm",
        "pre_monsoon_water_table_m_bgl",
        "post_monsoon_water_table_m_bgl",
        "river_proximity_km",
        "urban_drainage_stress",
        "wetland_buffer_index",
        "flood_risk_score",
    ]:
        _safe_numeric(df, col)

    df = df.dropna(how="all").reset_index(drop=True)
    return df


def build_training_dataset(
    odisha_csv: Path = DEFAULT_ODISHA_CSV,
    state_distribution_csv: Path = DEFAULT_STATE_DISTRIBUTION_CSV,
    target_column: Optional[str] = None,
    config: BuildConfig = BuildConfig(),
) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(config.seed)
    state_df = _load_state_distribution(state_distribution_csv)
    odisha_base = pd.read_csv(odisha_csv)
    odisha_df = _clean_odisha_rows(odisha_base)

    dummy_table = build_dummy_odisha_water_tables(seed=config.seed)

    training = odisha_df.merge(
        dummy_table,
        on="district",
        how="left",
        suffixes=("", "_dummy"),
    )

    water_bodies_odisha = _guess_water_bodies_for_odisha(state_df)

    for col in ["state", "latitude", "longitude"]:
        if col not in training.columns:
            training[col] = np.nan

    training["state"] = training["state"].fillna("Odisha")
    training["latitude"] = training["latitude"].fillna(training["latitude_dummy"])
    training["longitude"] = training["longitude"].fillna(training["longitude_dummy"])

    for col in [
        "coastal_exposure",
        "pre_monsoon_water_table_m_bgl",
        "post_monsoon_water_table_m_bgl",
        "monsoon_rainfall_mm",
        "river_proximity_km",
        "urban_drainage_stress",
        "wetland_buffer_index",
    ]:
        dummy_col = f"{col}_dummy"
        if col not in training.columns:
            training[col] = np.nan
        if dummy_col in training.columns:
            training[col] = training[col].fillna(training[dummy_col])

    if "water_bodies_count" not in training.columns:
        training["water_bodies_count"] = np.nan
    training["water_bodies_count"] = training["water_bodies_count"].fillna(water_bodies_odisha)

    training["seasonal_rise_m"] = (
        training["pre_monsoon_water_table_m_bgl"] - training["post_monsoon_water_table_m_bgl"]
    ).clip(lower=0.1)

    for col in REQUIRED_FEATURES:
        _safe_numeric(training, col)

    training["urban_drainage_stress"] = training["urban_drainage_stress"].fillna(
        pd.Series(rng.uniform(0.2, 0.9, size=len(training)))
    )
    training["wetland_buffer_index"] = training["wetland_buffer_index"].fillna(
        pd.Series(rng.uniform(0.1, 0.85, size=len(training)))
    )

    if target_column and target_column in training.columns:
        target_name = target_column
    elif "flood_risk_score" in training.columns and training["flood_risk_score"].notna().sum() >= max(8, len(training) // 3):
        target_name = "flood_risk_score"
    else:
        target_name = "flood_risk_score"
        training[target_name] = _synthesize_target(training, seed=config.seed)

    if target_name != "flood_risk_score":
        training["flood_risk_score"] = pd.to_numeric(training[target_name], errors="coerce")

    training = training.dropna(subset=REQUIRED_FEATURES + ["flood_risk_score"]).reset_index(drop=True)

    ML_DATA_DIR.mkdir(parents=True, exist_ok=True)
    dummy_table.to_csv(config.output_dummy_csv, index=False)
    training.to_csv(config.output_training_csv, index=False)

    return training, dummy_table

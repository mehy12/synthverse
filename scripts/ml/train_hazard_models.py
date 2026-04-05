from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from odisha_feature_builder import ODISHA_DISTRICT_META

ROOT = Path(__file__).resolve().parents[2]
DATASETS_DIR = ROOT / "datasets"
ARTIFACTS_DIR = ROOT / "scripts" / "ml" / "artifacts"
DATA_DIR = ROOT / "scripts" / "ml" / "data"

CYCLONE_SOURCE_CSV = DATASETS_DIR / "cyclone500.csv"
EARTHQUAKE_SOURCE_XLSX = DATASETS_DIR / "earthquake.xlsx"

CYCLONE_MODEL_FILE = ARTIFACTS_DIR / "cyclone_hazard_model.joblib"
EARTHQUAKE_MODEL_FILE = ARTIFACTS_DIR / "earthquake_hazard_model.joblib"
CYCLONE_METRICS_FILE = ARTIFACTS_DIR / "cyclone_hazard_metrics.json"
EARTHQUAKE_METRICS_FILE = ARTIFACTS_DIR / "earthquake_hazard_metrics.json"
CYCLONE_HEATMAP_CSV = DATA_DIR / "odisha_cyclone_heatmap.csv"
EARTHQUAKE_HEATMAP_CSV = DATA_DIR / "odisha_earthquake_heatmap.csv"

CYCLONE_FEATURES = [
    "latitude",
    "longitude",
    "coastal_exposure",
    "min_track_distance_km",
    "nearby_track_density",
    "max_wind_kts",
    "min_pressure_mb",
    "avg_dist2land_km",
    "landfall_rate",
    "storm_speed_kts",
]

EARTHQUAKE_FEATURES = [
    "latitude",
    "longitude",
    "coastal_exposure",
    "distance_to_epicenter_km",
    "magnitude",
    "depth_km",
]


@dataclass
class HazardModelResult:
    model_name: str
    rows_total: int
    mae: float
    r2: float
    feature_columns: list[str]
    model_file: Path
    heatmap_file: Path


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    d_lat = np.radians(lat2 - lat1)
    d_lon = np.radians(lon2 - lon1)
    a = (
        np.sin(d_lat / 2) ** 2
        + np.cos(np.radians(lat1))
        * np.cos(np.radians(lat2))
        * np.sin(d_lon / 2) ** 2
    )
    return float(radius_km * 2 * np.arcsin(np.sqrt(a)))


def _scalar_float(value: object, default: float) -> float:
    parsed = pd.to_numeric(value, errors="coerce")
    if pd.isna(parsed):
        return default
    return float(parsed)


def _coastal_flag(district: str) -> int:
    return 1 if ODISHA_DISTRICT_META[district]["coastal"] else 0


def _district_frame() -> pd.DataFrame:
    rows = []
    for district, meta in ODISHA_DISTRICT_META.items():
        rows.append(
            {
                "district": district,
                "latitude": meta["lat"],
                "longitude": meta["lon"],
                "coastal_exposure": int(meta["coastal"]),
            }
        )
    return pd.DataFrame(rows)


def _clean_cyclone_tracks(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [str(col).strip() for col in df.columns]

    for col in ["LAT", "LON", "WMO_WIND", "WMO_PRES", "DIST2LAND", "LANDFALL", "STORM_SPEED", "STORM_DIR"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["LAT", "LON"]).copy()
    return df.reset_index(drop=True)


def _build_cyclone_dataset(seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    tracks = _clean_cyclone_tracks(CYCLONE_SOURCE_CSV)

    features: list[dict[str, float | str]] = []
    latitudes = tracks["LAT"].to_numpy(dtype=float)
    longitudes = tracks["LON"].to_numpy(dtype=float)
    winds = tracks["WMO_WIND"].fillna(0).to_numpy(dtype=float)
    pressures = tracks["WMO_PRES"].fillna(np.nanmedian(tracks["WMO_PRES"].to_numpy(dtype=float)))
    dist2land = tracks["DIST2LAND"].fillna(np.nanmedian(tracks["DIST2LAND"].to_numpy(dtype=float)))
    landfall = tracks["LANDFALL"].fillna(0).to_numpy(dtype=float)
    speed = tracks["STORM_SPEED"].fillna(np.nanmedian(tracks["STORM_SPEED"].to_numpy(dtype=float)))

    for district, meta in ODISHA_DISTRICT_META.items():
        base_lat = meta["lat"]
        base_lon = meta["lon"]
        coastal = int(meta["coastal"])

        distances = np.array([
            haversine_km(base_lat, base_lon, float(lat), float(lon))
            for lat, lon in zip(latitudes, longitudes)
        ])
        nearest_idx = np.argsort(distances)[:18]
        nearby_distances = distances[nearest_idx]

        nearby_winds = winds[nearest_idx]
        nearby_pressures = pressures[nearest_idx]
        nearby_dist2land = dist2land[nearest_idx]
        nearby_landfall = landfall[nearest_idx]
        nearby_speed = speed[nearest_idx]

        min_track_distance = float(np.min(nearby_distances))
        density = float(np.mean(nearby_distances < 275))
        max_wind = float(np.nanmax(nearby_winds))
        min_pressure = float(np.nanmin(nearby_pressures))
        avg_dist2land = float(np.nanmean(nearby_dist2land))
        landfall_rate = float(np.mean(nearby_landfall > 0))
        storm_speed = float(np.nanmean(nearby_speed))

        base_score = (
            0.33 * (max_wind / 120.0) * 100
            + 0.20 * (1.0 - np.clip(min_pressure / 1050.0, 0, 1)) * 100
            + 0.18 * (1.0 - np.clip(min_track_distance / 550.0, 0, 1)) * 100
            + 0.10 * density * 100
            + 0.10 * coastal * 100
            + 0.06 * (1.0 - np.clip(avg_dist2land / 350.0, 0, 1)) * 100
            + 0.03 * np.clip(storm_speed / 60.0, 0, 1) * 100
            + 0.02 * landfall_rate * 100
        )

        for sample_idx in range(4):
            jitter_lat = base_lat + float(rng.normal(0, 0.018))
            jitter_lon = base_lon + float(rng.normal(0, 0.018))
            score = np.clip(base_score + rng.normal(0, 2.6), 5, 99)
            features.append(
                {
                    "district": district,
                    "latitude": jitter_lat,
                    "longitude": jitter_lon,
                    "coastal_exposure": coastal,
                    "min_track_distance_km": round(max(0.1, min_track_distance + float(rng.normal(0, 4.0))), 2),
                    "nearby_track_density": round(np.clip(density + float(rng.normal(0, 0.04)), 0, 1), 3),
                    "max_wind_kts": round(max(0.0, max_wind + float(rng.normal(0, 4.5))), 2),
                    "min_pressure_mb": round(max(860.0, min_pressure + float(rng.normal(0, 2.5))), 2),
                    "avg_dist2land_km": round(max(0.1, avg_dist2land + float(rng.normal(0, 8.0))), 2),
                    "landfall_rate": round(np.clip(landfall_rate + float(rng.normal(0, 0.05)), 0, 1), 3),
                    "storm_speed_kts": round(max(0.0, storm_speed + float(rng.normal(0, 3.0))), 2),
                    "risk_score": round(float(score), 2),
                }
            )

    return pd.DataFrame(features)


def _load_earthquake_event(path: Path) -> dict[str, float | str]:
    quake_df = pd.read_excel(path, header=1)
    quake_df.columns = [str(col).strip().lower() for col in quake_df.columns]

    row = quake_df.iloc[0]

    return {
        "magnitude": _scalar_float(row.get("magnitude"), 4.0),
        "latitude": _scalar_float(row.get("lat"), 18.573),
        "longitude": _scalar_float(row.get("long"), 82.559),
        "depth_km": _scalar_float(row.get("depth"), 5.0),
        "region": str(row.get("region") or "Odisha seismic event"),
        "location": str(row.get("location") or "Odisha"),
    }


def _build_earthquake_dataset(seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    event = _load_earthquake_event(EARTHQUAKE_SOURCE_XLSX)

    rows: list[dict[str, float | str]] = []
    for district, meta in ODISHA_DISTRICT_META.items():
        base_lat = meta["lat"]
        base_lon = meta["lon"]
        coastal = int(meta["coastal"])
        epicenter_distance = haversine_km(base_lat, base_lon, event["latitude"], event["longitude"])

        intensity_base = (
            event["magnitude"] * 12.5
            + (14.0 / (event["depth_km"] + 2.0)) * 5.0
            + (1.0 - np.clip(epicenter_distance / 500.0, 0, 1)) * 45.0
            + coastal * 4.5
        )

        for sample_idx in range(4):
            jitter_lat = base_lat + float(rng.normal(0, 0.015))
            jitter_lon = base_lon + float(rng.normal(0, 0.015))
            score = np.clip(intensity_base + rng.normal(0, 2.8), 5, 99)
            rows.append(
                {
                    "district": district,
                    "latitude": jitter_lat,
                    "longitude": jitter_lon,
                    "coastal_exposure": coastal,
                    "distance_to_epicenter_km": round(max(0.1, epicenter_distance + float(rng.normal(0, 5.0))), 2),
                    "magnitude": round(float(event["magnitude"] + rng.normal(0, 0.08)), 2),
                    "depth_km": round(max(0.1, float(event["depth_km"] + rng.normal(0, 0.9))), 2),
                    "risk_score": round(float(score), 2),
                }
            )

    return pd.DataFrame(rows)


def _train_regressor(
    df: pd.DataFrame,
    features: Iterable[str],
    target: str,
    model_file: Path,
    metrics_file: Path,
    seed: int,
) -> dict:
    x = df[list(features)].copy()
    y = df[target].copy()

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=seed,
    )

    model = RandomForestRegressor(
        n_estimators=320,
        max_depth=14,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=seed,
        n_jobs=-1,
    )
    model.fit(x_train, y_train)

    preds = model.predict(x_test)
    metrics = {
        "rows_total": int(len(df)),
        "mae": float(mean_absolute_error(y_test, preds)),
        "r2": float(r2_score(y_test, preds)),
        "feature_columns": list(features),
        "target": target,
        "model": "RandomForestRegressor",
    }

    model_file.parent.mkdir(parents=True, exist_ok=True)
    metrics_file.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_file)
    with open(metrics_file, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    return {"model": model, "metrics": metrics}


def _write_heatmap(df: pd.DataFrame, output: Path, hazard: str) -> pd.DataFrame:
    heatmap = df[["latitude", "longitude", "district", "risk_score"]].copy()
    heatmap.insert(0, "hazard", hazard)
    heatmap["risk_score"] = heatmap["risk_score"].round(2)
    heatmap["weight"] = (heatmap["risk_score"] / 100).clip(0.1, 1.0).round(3)
    heatmap.to_csv(output, index=False)
    return heatmap


def train(seed: int = 42) -> dict:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    cyclone_df = _build_cyclone_dataset(seed=seed)
    earthquake_df = _build_earthquake_dataset(seed=seed)

    cyclone_result = _train_regressor(
        cyclone_df,
        CYCLONE_FEATURES,
        "risk_score",
        CYCLONE_MODEL_FILE,
        CYCLONE_METRICS_FILE,
        seed,
    )
    earthquake_result = _train_regressor(
        earthquake_df,
        EARTHQUAKE_FEATURES,
        "risk_score",
        EARTHQUAKE_MODEL_FILE,
        EARTHQUAKE_METRICS_FILE,
        seed,
    )

    cyclone_heatmap = _write_heatmap(cyclone_df, CYCLONE_HEATMAP_CSV, "cyclone")
    earthquake_heatmap = _write_heatmap(earthquake_df, EARTHQUAKE_HEATMAP_CSV, "earthquake")

    return {
        "cyclone": {
            **cyclone_result["metrics"],
            "model_file": str(CYCLONE_MODEL_FILE),
            "heatmap_file": str(CYCLONE_HEATMAP_CSV),
            "hotspots": int(len(cyclone_heatmap)),
        },
        "earthquake": {
            **earthquake_result["metrics"],
            "model_file": str(EARTHQUAKE_MODEL_FILE),
            "heatmap_file": str(EARTHQUAKE_HEATMAP_CSV),
            "hotspots": int(len(earthquake_heatmap)),
        },
    }


if __name__ == "__main__":
    summary = train()
    print(json.dumps(summary, indent=2))
    print(f"Cyclone heatmap: {CYCLONE_HEATMAP_CSV}")
    print(f"Earthquake heatmap: {EARTHQUAKE_HEATMAP_CSV}")

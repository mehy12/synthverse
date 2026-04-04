from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from config import (
    ARTIFACTS_DIR,
    DEFAULT_SOURCE_CSV,
    FEATURE_IMPORTANCE_FILE,
    METRICS_FILE,
    MODEL_FILE,
    ODISHA_WATER_TABLE_CSV,
    TRAINING_DATA_CSV,
)
from data_pipeline import PipelineConfig, build_training_frame, load_state_distribution


FEATURES = [
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

TARGET = "flood_risk_score"


def ensure_dirs() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    Path(ODISHA_WATER_TABLE_CSV).parent.mkdir(parents=True, exist_ok=True)


def train(csv_path: Path = DEFAULT_SOURCE_CSV) -> dict:
    ensure_dirs()

    state_df = load_state_distribution(csv_path)
    train_df, odisha_table = build_training_frame(state_df, PipelineConfig())

    train_df.to_csv(TRAINING_DATA_CSV, index=False)
    odisha_table.to_csv(ODISHA_WATER_TABLE_CSV, index=False)

    x = train_df[FEATURES]
    y = train_df[TARGET]

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42
    )

    model = RandomForestRegressor(
        n_estimators=360,
        max_depth=14,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x_train, y_train)

    preds = model.predict(x_test)

    metrics = {
        "rows_total": int(len(train_df)),
        "rows_odisha": int((train_df["state"] == "Odisha").sum()),
        "mae": float(mean_absolute_error(y_test, preds)),
        "r2": float(r2_score(y_test, preds)),
        "feature_columns": FEATURES,
        "target": TARGET,
        "model": "RandomForestRegressor",
    }

    joblib.dump(model, MODEL_FILE)
    with open(METRICS_FILE, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    fi = pd.DataFrame(
        {
            "feature": FEATURES,
            "importance": model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)
    fi.to_csv(FEATURE_IMPORTANCE_FILE, index=False)

    return metrics


if __name__ == "__main__":
    metrics = train()
    print("Training complete")
    print(json.dumps(metrics, indent=2))
    print(f"Model: {MODEL_FILE}")
    print(f"Metrics: {METRICS_FILE}")
    print(f"Odisha dummy water-table data: {ODISHA_WATER_TABLE_CSV}")

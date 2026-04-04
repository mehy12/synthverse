from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from odisha_feature_builder import (
    DEFAULT_ODISHA_CSV,
    DEFAULT_STATE_DISTRIBUTION_CSV,
    REQUIRED_FEATURES,
    build_training_dataset,
)

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = ROOT / "scripts" / "ml" / "artifacts"

MODEL_FILE = ARTIFACTS_DIR / "odisha_flood_model.joblib"
METRICS_FILE = ARTIFACTS_DIR / "odisha_metrics.json"
FEATURE_IMPORTANCE_FILE = ARTIFACTS_DIR / "odisha_feature_importance.csv"


def _evaluate(y_true: pd.Series, y_pred: pd.Series) -> dict:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(mean_squared_error(y_true, y_pred) ** 0.5),
        "r2": float(r2_score(y_true, y_pred)),
    }


def train(odisha_csv: Path, state_distribution_csv: Path, target_column: str | None, seed: int) -> dict:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    train_df, _ = build_training_dataset(
        odisha_csv=odisha_csv,
        state_distribution_csv=state_distribution_csv,
        target_column=target_column,
    )

    x = train_df[REQUIRED_FEATURES]
    y = train_df["flood_risk_score"]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=seed,
    )

    candidates = {
        "random_forest": RandomForestRegressor(
            n_estimators=360,
            max_depth=14,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=seed,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingRegressor(
            n_estimators=320,
            max_depth=3,
            learning_rate=0.05,
            random_state=seed,
        ),
    }

    best_name = None
    best_model = None
    best_metrics = None

    for name, model in candidates.items():
        model.fit(x_train, y_train)
        preds = model.predict(x_test)
        metrics = _evaluate(y_test, preds)
        if best_metrics is None or metrics["mae"] < best_metrics["mae"]:
            best_name = name
            best_model = model
            best_metrics = metrics

    assert best_model is not None
    assert best_metrics is not None

    joblib.dump(best_model, MODEL_FILE)

    fi = pd.DataFrame(
        {
            "feature": REQUIRED_FEATURES,
            "importance": best_model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)
    fi.to_csv(FEATURE_IMPORTANCE_FILE, index=False)

    summary = {
        "model_name": best_name,
        "rows_total": int(len(train_df)),
        "rows_odisha": int((train_df["state"].astype(str).str.lower() == "odisha").sum()),
        "features": REQUIRED_FEATURES,
        "target": "flood_risk_score",
        "metrics": best_metrics,
        "model_file": str(MODEL_FILE),
        "feature_importance_file": str(FEATURE_IMPORTANCE_FILE),
    }

    with open(METRICS_FILE, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train Odisha flood-risk model using Odisha CSV + Odisha-focused dummy water tables")
    parser.add_argument("--odisha-csv", type=Path, default=DEFAULT_ODISHA_CSV)
    parser.add_argument("--state-distribution-csv", type=Path, default=DEFAULT_STATE_DISTRIBUTION_CSV)
    parser.add_argument("--target-column", type=str, default=None)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.odisha_csv.exists():
        raise FileNotFoundError(
            f"Odisha CSV not found at {args.odisha_csv}. Place your dataset there or pass --odisha-csv."
        )
    if not args.state_distribution_csv.exists():
        raise FileNotFoundError(
            f"State distribution CSV not found at {args.state_distribution_csv}."
        )

    summary = train(
        odisha_csv=args.odisha_csv,
        state_distribution_csv=args.state_distribution_csv,
        target_column=args.target_column,
        seed=args.seed,
    )

    print("Training complete")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

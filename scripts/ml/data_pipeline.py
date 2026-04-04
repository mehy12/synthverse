from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import numpy as np
import pandas as pd


@dataclass
class PipelineConfig:
    random_seed: int = 42
    synthetic_rows_per_non_odisha_state: int = 4


ODISHA_DISTRICTS = [
    "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh",
    "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal",
    "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur",
    "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh",
]

COASTAL_DISTRICTS = {"Balasore", "Bhadrak", "Jagatsinghpur", "Kendrapara", "Puri", "Ganjam"}


def _normalize_state_name(value: str) -> str:
    return str(value).strip().replace('"', "")


def load_state_distribution(csv_path: str | bytes | "os.PathLike[str]") -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    if "Category" not in df.columns or "Water Bodies Count" not in df.columns:
        raise ValueError("CSV must contain 'Category' and 'Water Bodies Count' columns")

    df = df.rename(columns={"Category": "state", "Water Bodies Count": "water_bodies_count"}).copy()
    df["state"] = df["state"].astype(str).map(_normalize_state_name)
    df["water_bodies_count"] = pd.to_numeric(df["water_bodies_count"], errors="coerce")

    # Remove malformed state rows like numeric bins (0,1,2)
    df = df[df["state"].str.contains(r"[A-Za-z]", regex=True, na=False)]
    df = df.dropna(subset=["water_bodies_count"]).reset_index(drop=True)
    return df


def create_odisha_water_table_dummy_df(seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    records = []
    for district in ODISHA_DISTRICTS:
        coastal = 1 if district in COASTAL_DISTRICTS else 0
        pre_depth = float(rng.uniform(1.8, 8.2) - (0.9 if coastal else 0.0))
        pre_depth = max(0.6, pre_depth)

        post_depth = float(pre_depth - rng.uniform(0.4, 2.3))
        post_depth = max(0.2, post_depth)

        monsoon_mm = float(rng.uniform(900, 1800) + (220 if coastal else 0))
        river_proximity_km = float(rng.uniform(0.5, 14.0) - (0.3 if coastal else 0.0))
        river_proximity_km = max(0.1, river_proximity_km)

        records.append(
            {
                "state": "Odisha",
                "district": district,
                "coastal_exposure": coastal,
                "pre_monsoon_water_table_m_bgl": round(pre_depth, 2),
                "post_monsoon_water_table_m_bgl": round(post_depth, 2),
                "seasonal_rise_m": round(pre_depth - post_depth, 2),
                "monsoon_rainfall_mm": round(monsoon_mm, 1),
                "river_proximity_km": round(river_proximity_km, 2),
            }
        )

    return pd.DataFrame.from_records(records)


def _build_target(df: pd.DataFrame, rng: np.random.Generator) -> pd.Series:
    # Weighted synthetic target for flood susceptibility in [5, 99]
    raw = (
        0.00023 * df["water_bodies_count"]
        + 0.017 * df["monsoon_rainfall_mm"]
        + 8.0 * df["coastal_exposure"]
        + 5.5 * df["urban_drainage_stress"]
        + 4.0 * df["seasonal_rise_m"]
        + 3.0 * (1.0 / (df["river_proximity_km"] + 0.5))
        - 2.2 * df["wetland_buffer_index"]
        + rng.normal(0.0, 2.2, size=len(df))
    )
    return raw.clip(5, 99).round(2)


def build_training_frame(state_df: pd.DataFrame, config: PipelineConfig = PipelineConfig()) -> Tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(config.random_seed)

    odisha_table = create_odisha_water_table_dummy_df(seed=config.random_seed)
    odisha_count = float(
        state_df.loc[state_df["state"].str.lower() == "odisha", "water_bodies_count"].iloc[0]
    )

    # Odisha gets richer synthetic samples based on district-level dummy water-table data
    odisha_rows = odisha_table.copy()
    odisha_rows["water_bodies_count"] = odisha_count
    odisha_rows["urban_drainage_stress"] = rng.uniform(0.35, 0.92, size=len(odisha_rows)).round(3)
    odisha_rows["wetland_buffer_index"] = rng.uniform(0.25, 0.9, size=len(odisha_rows)).round(3)

    # For other states, generate compact synthetic records from state-level count
    other_rows = []
    for _, row in state_df[state_df["state"].str.lower() != "odisha"].iterrows():
        for i in range(config.synthetic_rows_per_non_odisha_state):
            other_rows.append(
                {
                    "state": row["state"],
                    "district": f"{row['state']}_zone_{i+1}",
                    "coastal_exposure": int(row["state"] in {"Andhra Pradesh", "TamilNadu", "Kerala", "West Bengal", "Gujarat", "Goa"}),
                    "pre_monsoon_water_table_m_bgl": round(float(rng.uniform(2.2, 11.5)), 2),
                    "post_monsoon_water_table_m_bgl": round(float(rng.uniform(0.7, 7.0)), 2),
                    "seasonal_rise_m": round(float(rng.uniform(0.3, 3.2)), 2),
                    "monsoon_rainfall_mm": round(float(rng.uniform(550, 2200)), 1),
                    "river_proximity_km": round(float(rng.uniform(0.4, 25)), 2),
                    "water_bodies_count": float(row["water_bodies_count"]),
                    "urban_drainage_stress": round(float(rng.uniform(0.18, 0.93)), 3),
                    "wetland_buffer_index": round(float(rng.uniform(0.08, 0.88)), 3),
                }
            )

    other_df = pd.DataFrame.from_records(other_rows)

    train_df = pd.concat([odisha_rows, other_df], ignore_index=True)
    train_df["flood_risk_score"] = _build_target(train_df, rng)

    return train_df, odisha_table

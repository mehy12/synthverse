from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from odisha_feature_builder import ODISHA_DISTRICT_META

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / "datasets"
DEFAULT_RAINFALL_XLSX = ROOT / "datasets" / "odisha_rainfall.xlsx"

SCENARIOS = {
    "normal": {
        "rainfall_factor": 1.0,
        "rainfall_boost": 0.0,
        "drainage_boost": 0.0,
        "river_shift": 0.0,
        "depth_drop": 0.0,
    },
    "rain": {
        "rainfall_factor": 1.18,
        "rainfall_boost": 70.0,
        "drainage_boost": 0.08,
        "river_shift": -0.45,
        "depth_drop": 0.18,
    },
    "heavy_rain": {
        "rainfall_factor": 1.42,
        "rainfall_boost": 150.0,
        "drainage_boost": 0.18,
        "river_shift": -0.85,
        "depth_drop": 0.42,
    },
}

DISTRICT_ALIASES = {
    "bolangir": "Balangir",
    "boudhgarh": "Boudh",
    "keonjhargarh": "Kendujhar",
    "khurda": "Khordha",
    "nawapara": "Nuapada",
    "nawarangpur": "Nabarangpur",
    "sonepur": "Subarnapur",
}


def _district_key(value: str) -> str:
    return "".join(ch for ch in str(value).strip().lower() if ch.isalpha())


def load_rainfall_map(rainfall_xlsx: Path) -> dict[str, float]:
    if not rainfall_xlsx.exists():
        return {}

    frame: pd.DataFrame | None = None
    for sheet in [0, "Rainfall Data"]:
        try:
            frame = pd.read_excel(rainfall_xlsx, sheet_name=sheet)
            break
        except Exception:
            continue

    if frame is None or frame.empty:
        return {}

    columns = list(frame.columns)

    district_col = next(
        (col for col in columns if "district" in str(col).strip().lower()),
        None,
    )
    rainfall_col = next(
        (
            col
            for col in columns
            if "period actual" in str(col).strip().lower()
            or "day actual" in str(col).strip().lower()
        ),
        None,
    )

    if district_col is None or rainfall_col is None:
        return {}

    known = {_district_key(name): name for name in ODISHA_DISTRICT_META}
    mapped: dict[str, float] = {}

    for _, row in frame.iterrows():
        district_raw = str(row.get(district_col, "")).strip()
        if not district_raw:
            continue
        district_key = _district_key(district_raw)
        district = DISTRICT_ALIASES.get(district_key) or known.get(district_key)
        if not district:
            continue

        rainfall = pd.to_numeric(row.get(rainfall_col), errors="coerce")
        if pd.isna(rainfall):
            continue
        mapped[district] = float(rainfall)

    return mapped


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def synthesize_risk(row: dict[str, float], rng: np.random.Generator) -> float:
    raw = (
        0.00025 * row["water_bodies_count"]
        + 0.017 * row["monsoon_rainfall_mm"]
        + 9.2 * row["coastal_exposure"]
        + 5.8 * row["urban_drainage_stress"]
        + 4.4 * row["seasonal_rise_m"]
        + 3.3 * (1.0 / (row["river_proximity_km"] + 0.38))
        - 2.3 * row["wetland_buffer_index"]
        + rng.normal(0.0, 1.8)
    )
    return round(clamp(raw, 5, 99), 2)


def build_scenario_dataset(
    scenario_name: str,
    samples_per_district: int,
    seed: int,
    rainfall_by_district: dict[str, float] | None = None,
) -> pd.DataFrame:
    if scenario_name not in SCENARIOS:
        raise ValueError(f"Unsupported scenario: {scenario_name}")

    scenario_cfg = SCENARIOS[scenario_name]
    rng = np.random.default_rng(seed)
    rows: list[dict[str, float | str | int]] = []

    for district, meta in ODISHA_DISTRICT_META.items():
        coastal = int(meta["coastal"])
        base_lat = float(meta["lat"])
        base_lon = float(meta["lon"])

        for _ in range(samples_per_district):
            lat_jitter = float(rng.normal(0, 0.12))
            lon_jitter = float(rng.normal(0, 0.12))

            pre_depth = float(rng.uniform(1.5, 8.9) - (0.7 if coastal else 0.0))
            pre_depth = max(0.5, pre_depth)

            seasonal_rise = float(rng.uniform(0.5, 3.0) + (0.35 if coastal else 0.0))
            post_depth = max(0.2, pre_depth - seasonal_rise - scenario_cfg["depth_drop"])
            seasonal_rise = max(0.1, pre_depth - post_depth)

            rainfall_base = (
                float(rainfall_by_district.get(district))
                if rainfall_by_district and district in rainfall_by_district
                else float(rng.uniform(980, 1850) + (190 if coastal else 0.0))
            )
            rainfall = float(
                rainfall_base * scenario_cfg["rainfall_factor"]
                + scenario_cfg["rainfall_boost"]
                + rng.normal(0, 22)
            )
            rainfall = max(120, rainfall)
            river_proximity = float(rng.uniform(0.2, 16.0) - (0.35 if coastal else 0.0) + scenario_cfg["river_shift"])
            river_proximity = max(0.1, river_proximity)

            drainage = clamp(float(rng.uniform(0.22, 0.92) + scenario_cfg["drainage_boost"]), 0.1, 0.98)
            wetland = clamp(float(rng.uniform(0.12, 0.89) - scenario_cfg["drainage_boost"] * 0.2), 0.05, 0.96)

            water_bodies = int(max(50000, rng.normal(91000 + coastal * 9000, 8500)))

            row: dict[str, float | str | int] = {
                "state": "Odisha",
                "district": district,
                "latitude": round(base_lat + lat_jitter, 5),
                "longitude": round(base_lon + lon_jitter, 5),
                "water_bodies_count": water_bodies,
                "coastal_exposure": coastal,
                "pre_monsoon_water_table_m_bgl": round(pre_depth, 2),
                "post_monsoon_water_table_m_bgl": round(post_depth, 2),
                "seasonal_rise_m": round(seasonal_rise, 2),
                "monsoon_rainfall_mm": round(rainfall, 1),
                "river_proximity_km": round(river_proximity, 2),
                "urban_drainage_stress": round(drainage, 3),
                "wetland_buffer_index": round(wetland, 3),
                "rainfall_scenario": scenario_name,
            }
            row["flood_risk_score"] = synthesize_risk(row, rng)
            rows.append(row)

    return pd.DataFrame(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate dense Odisha synthetic datasets for normal/rain/heavy-rain scenarios")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--samples-per-district", type=int, default=18)
    parser.add_argument("--seed", type=int, default=77)
    parser.add_argument("--rainfall-xlsx", type=Path, default=DEFAULT_RAINFALL_XLSX)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    rainfall_by_district = load_rainfall_map(args.rainfall_xlsx)
    if rainfall_by_district:
        print(f"Loaded rainfall baseline for {len(rainfall_by_district)} districts from {args.rainfall_xlsx}")
    else:
        print("No district rainfall baseline loaded; falling back to synthetic rainfall ranges.")

    all_rows: list[pd.DataFrame] = []

    for i, scenario in enumerate(SCENARIOS.keys()):
        frame = build_scenario_dataset(
            scenario_name=scenario,
            samples_per_district=args.samples_per_district,
            seed=args.seed + i * 13,
            rainfall_by_district=rainfall_by_district,
        )
        all_rows.append(frame)
        output = args.output_dir / f"odisha_synthetic_{scenario}.csv"
        frame.to_csv(output, index=False)
        print(f"Generated {len(frame)} rows -> {output}")

    combined = pd.concat(all_rows, ignore_index=True)
    combined_output = args.output_dir / "odisha_synthetic_all_scenarios.csv"
    combined.to_csv(combined_output, index=False)
    print(f"Generated {len(combined)} rows -> {combined_output}")


if __name__ == "__main__":
    main()

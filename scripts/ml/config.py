from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATASETS_DIR = ROOT / "datasets"
ML_DIR = ROOT / "scripts" / "ml"
ARTIFACTS_DIR = ML_DIR / "artifacts"
GENERATED_DATA_DIR = ML_DIR / "data"

DEFAULT_SOURCE_CSV = DATASETS_DIR / "state-wise-distribution.csv"
ODISHA_WATER_TABLE_CSV = GENERATED_DATA_DIR / "odisha_water_tables_dummy.csv"
TRAINING_DATA_CSV = GENERATED_DATA_DIR / "training_dataset.csv"

MODEL_FILE = ARTIFACTS_DIR / "flood_risk_model.joblib"
METRICS_FILE = ARTIFACTS_DIR / "metrics.json"
FEATURE_IMPORTANCE_FILE = ARTIFACTS_DIR / "feature_importance.csv"

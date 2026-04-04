Odisha Training Workflow

1. Place your Odisha dataset CSV at:

- datasets/odisha_dataset.csv

Or pass a custom CSV path with --odisha-csv.

2. Install Python dependencies:

- pip install -r scripts/ml/requirements.txt

3. Train the model:

- python scripts/ml/train_odisha_model.py --odisha-csv datasets/odisha_dataset.csv

Optional target column:

- python scripts/ml/train_odisha_model.py --odisha-csv datasets/odisha_dataset.csv --target-column flood_risk_score

What this does:

- Builds Odisha-focused dummy groundwater tables for all Odisha districts.
- Merges your Odisha CSV with district-level dummy hydrology features.
- Trains two regressors and keeps the better one by MAE.
- Saves model and metrics to scripts/ml/artifacts.

Outputs:

- scripts/ml/artifacts/odisha_flood_model.joblib
- scripts/ml/artifacts/odisha_metrics.json
- scripts/ml/artifacts/odisha_feature_importance.csv
- scripts/ml/data/odisha_water_tables_dummy.csv
- scripts/ml/data/odisha_training_dataset.csv

4. Predict on new rows:

- python scripts/ml/predict_odisha_risk.py --input-csv <your_input.csv>

Prediction output:

- scripts/ml/data/odisha_predictions.csv

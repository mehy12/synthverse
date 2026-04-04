import csv
import json
import random

CIRCL_COORDS = {
    "Berhampur": [19.31, 84.79],
    "Burla": [21.50, 83.87],
    "Chainpal": [20.94, 85.15],
    "Cuttack": [20.46, 85.88],
    "Jajpur Road": [20.95, 86.13],
    "Jeypore": [18.86, 82.55],
    "Bolangir": [20.71, 83.48]
}

# Fallback for missing circles
DEFAULT_COORD = [20.29, 85.82]

input_path = "datasets/powergrid.csv"
output_path = "src/data/power-grid-locations.json"

results = []
try:
    with open(input_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Check if row is a valid substation row (not a header repeat)
            if not row["Sl No"] or row["Sl No"] == "Sl No":
                continue
                
            circle = row["Circle"]
            base_coord = CIRCL_COORDS.get(circle, DEFAULT_COORD)
            
            # Add jitter to avoid overlapping (0.4 degree radius)
            lat = base_coord[0] + (random.random() - 0.5) * 0.8
            lng = base_coord[1] + (random.random() - 0.5) * 0.8
            
            results.append({
                "id": row["Sl No"],
                "circle": circle,
                "division": row["Division"],
                "name": row["Substation Name"],
                "kv": row["kV Level"],
                "capacity": row["Total Capacity (MVA)"],
                "loading": row["Grid Loading (%)"],
                "lat": round(lat, 4),
                "lng": round(lng, 4)
            })

    with open(output_path, mode="w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"Geocoded {len(results)} substations to {output_path}")
except Exception as e:
    print(f"Error: {e}")

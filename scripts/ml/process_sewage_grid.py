import csv
import json
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

input_path = "datasets/sewagegrids.csv"
output_path = "src/data/sewage-grid-locations.json"

nodes = []
with open(input_path, mode="r", encoding="utf-8") as f:
    # Handle the '@' prefix in headers
    reader = csv.DictReader(f, delimiter='\t')
    for row in reader:
        try:
            nodes.append({
                "id": row["@id"],
                "lat": float(row["@lat"]),
                "lon": float(row["@lon"]),
                "name": row.get("name", ""),
                "kind": row.get("waterway", "drain") or "drain",
            })
        except (ValueError, KeyError):
            continue

# Limiting to first 600 nodes for performance if the network is too dense, 
# but let's try the full set if it's manageable (~1100).
# Actually, let's keep all.

with open(output_path, mode="w", encoding="utf-8") as f:
    json.dump(nodes, f, indent=2)

print(f"Processed {len(nodes)} sewage nodes to {output_path}")

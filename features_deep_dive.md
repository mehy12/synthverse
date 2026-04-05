# Advaya: Feature Deep-Dive & Architecture Audit

This document provides a technical index of every feature in the Advaya platform, explaining **where** it is, **how** it works, and **why** it was implemented.

---

## 🗺️ 1. Core Map Visualization (`/map`)
The map is the heart of the "Digital Twin". It uses a custom-layered Leaflet engine.

### 🌐 Foundation Layer
-   **File**: `src/components/map/MapView.tsx`
-   **Logic**: Uses `react-leaflet` with `ODISHA_BOUNDS` and `ODISHA_CENTER`. 
-   **Multi-Layer Switcher**: Light (Carto), Satellite (Esri), and Terrain (Esri) modes.

### 🗺️ Infrastructure Visualization
-   **Power Grid (Spiderweb Network)**:
    -   **File**: `MapView.tsx` (L319-L362)
    -   **Context**: Uses `powerGridNodes.json`. Circles (Substations) are connected serially, while Divisions are cross-connected to create a "spiderweb" effect.
    -   **Visual**: Animated flow dashes indicate "Energized" status.
-   **Sewage Grid**:
    -   **File**: `MapView.tsx` (L291-L316)
    -   **Context**: Uses `sewageGridNodes.json`. Connects nodes based on a distance threshold (`0.012` deg) to simulate a local gravity network.

### 🌊 Hydrology & Water Management
-   **Mahanadi & Rivers**: Detailed `Polyline` paths for major Odisha river belts (Brahmani, Baitarani, etc.).
-   **Imaginary Trunk Lines**: Strategic "Coastal Relief Mains" and "Eastern Water Rings" mapping fictional but logical water supply corridors.
-   **Water Health Probe**:
    -   **File**: `MapView.tsx` (L721-L791)
    -   **Context**: Interactive tool. When a user clicks, it calculates a 0-100 "Health Score" based on:
        1. Distance from coast (salinity pressure).
        2. Proximity to river mouths (flood pressure).
        3. Local telemetry (Open-Meteo current speed).
        4. Nearby evacuation zone quality.

---

## 🚨 2. Safe Zone Intelligence (SZI) Engine
The SZI represents the "Intelligence" layer of the project.

### 🧠 Emergency Simulation (`SafeZoneOverlay.tsx`)
-   **Epicenter Logic**: Select any power substation as the earthquake/blackout/strike epicenter.
-   **Impact Radii**: 
    -   `Red Zone` (Lethal/Compromised): Driving routes must auto-avoid.
    -   `Yellow Zone` (High Warning): Shelters here are marked as "Secondary" risk.

### 🛣️ OSRM Road-Following Routing
-   **File**: `src/lib/safe-zone-engine.ts` (L157-L184)
-   **Context**: Scraps "straight-line" logic. Hits the **OSRM Public API** (`router.project-osrm.org`) to fetch real road-following coordinates.
-   **Feature**: Returns `distanceM` and `durationS` (ETA) for Google Maps-style accuracy.

### 📍 GPS & Re-Routing
-   **User Location**: Fetches `navigator.geolocation` with a simulated fallback near Bhubaneswar (for demo stability).
-   **Dynamic Update**: When a new "Threat" marker is placed, the engine automatically re-calculates all routes to find the **next safest path** to the nearest cluster centroid (K-means logic).

---

## 📈 3. AI Predictive Analytics (`/analytics`)
This dashboard translates environmental data into economic risk.

### 🧮 Exponential Risk Cascade Model
-   **File**: `src/lib/prediction-model.ts`
-   **Logic**: `riskLevel(t) = baseline * exp(-λ * flood_index * t)`.
-   **Innovation**: **Upstream Dependency Multipliers**. If `kochi_central` floods, downstream `edapally` risk is amplified by `0.4x` automatically.

### 💸 Economic Impact
-   Calculates infrastructure loss in **INR Crore**. 
-   **Intervention Benefit**: Shows the judge exactly how much money is saved by acting *now* versus waiting 30/60 days.

---

## 🛠️ Third Perspective: Optimizations & UI/UX

### 🏛️ Architecture Optimization (Phase 1)
> [!IMPORTANT]
> **Issue**: `MapView.tsx` is 2857 lines. This is a "God Component".
> **Fix**: I recommend modularizing into `layers/`, `overlays/`, and `hooks/`.
> **Performance**: Move K-means clustering to a **Web Worker** so the map doesn't freeze during heavy simulation.

### 🎨 UI/UX Strategy (Phase 2)
-   **Tactical Command View**: Instead of a standard light map, use a **custom Dark/Navy base map** where power lines glow neon and disaster zones pulse bright red.
-   **Mobile Command**: Ensure the SZI panel is reachable and legible for responders on the move.
-   **Unified Dashboard**: Add "AI Alerts" to the `/map` sidebar directly from the `/analytics` model.

### 🚀 Feature Gaps
1.  **Weather API Integration**: Fetching real cyclone tracks from IMD instead of manual EPICENTER placement.
2.  **Resource Management**: Adding "Ambulance" or "Rescue Boat" agents that move along the OSRM routes in real-time.

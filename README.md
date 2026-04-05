# Advaya: Odisha Safe Zone Intelligence & 3D Digital Twin

Advaya is a comprehensive, real-time disaster resilience and emergency routing platform designed for the Odisha region. It combines high-fidelity 3D mapping with sophisticated AI forecasting to identify danger zones and dynamically route civilians to safety during natural calamities or industrial emergencies.

## 🚀 Key Innovation Pillars

-   **Dynamic Intelligence (SZI)**: Cascading impact simulation with K-means shelter clustering and real-time OSRM road-based routing.
-   **3D Digital Twin**: Deck.gl-powered 3D visualization of risk hotspots for immediate situational awareness.
-   **Predictive AI**: District-level cascade forecasting for flood risk acceleration and economic impact modeling.
-   **Infrastructure Mapping**: Deep visualization of Power and Sewage grids with logic-driven spiderweb routing.

## 🏗️ Technical Stack

-   **Frontend**: Next.js 16 (App Router), React 19, TypeScript
-   **Mapping**: Leaflet, React-Leaflet, Deck.gl
-   **Routing**: OSRM (Open Source Routing Machine) Public API
-   **Simulation**: Custom D3.js & K-means engines
-   **Data Visualization**: Heatmaps (Flood, Cyclone, Earthquake modes)

## 🗺️ Feature Deep Dive

For a detailed technical breakdown of every feature, architectural decisions, and optimization strategies, refer to:
👉 [**features_deep_dive.md**](./features_deep_dive.md)

## 📁 Codebase Structure

-   `src/app`: Application routes (/map, /analytics, /api)
-   `src/components/map`: Map engine, layers, and SZI overlays
-   `src/lib`: Core intelligence logic (Routing, Impact Engine, AI Models)
-   `src/data` & `datasets`: Static and dynamic geocoded datasets
-   `public`: Static assets and markers

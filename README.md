# Urban Heat & Vegetation Analysis (Google Earth Engine)

This repository contains a Google Earth Engine (GEE) workflow for neighborhood-scale **Land Surface Temperature (LST)** analysis using **Landsat Collection 2 Level-2** imagery. It also derives **NDVI** (vegetation) and **NDBI** (built-up intensity), performs **zonal statistics** over census tracts, and includes exploratory modeling (Pearson correlation, Random Forest regression, and K-Means clustering).

The default configuration uses **Phoenix, Arizona** as an example study area and **Summer 2023** as the analysis window. You can adapt the ROI, dates, and administrative boundaries to your own region.

## Repository layout

```
.
├─ src/
│  └─ gee/
│     └─ urban_heat_analysis.js        # Main GEE script (copy into the Code Editor)
├─ docs/
│  └─ report.docx                      # Supporting write-up / report (optional)
├─ data/
│  ├─ outputs/                         # Exported tables (CSV) from GEE Tasks
│  └─ derived/                         # Exported rasters (GeoTIFF) from GEE Tasks
├─ figures/                            # Exported plots / map screenshots
├─ notebooks/                          # Optional post-processing (placeholder)
├─ .gitignore
└─ LICENSE
```

## Data sources (via the GEE Data Catalog)

- Landsat 8 Collection 2 Level 2: `LANDSAT/LC08/C02/T1_L2`
- Census Tracts (TIGER/Line 2020): `TIGER/2020/TRACT`
- SRTM Elevation: `USGS/SRTMGL1_003`

## What the script does

- Loads Landsat imagery for the target season and study area
- Masks clouds/shadows (QA_PIXEL) and applies Collection 2 scaling factors
- Computes NDVI, NDBI, and NDWI-based water masking
- Derives LST (single-channel approach using emissivity estimated from NDVI)
- Aggregates mean values by tract polygons (zonal statistics)
- Runs:
  - Pearson correlation (NDVI vs LST)
  - Random Forest regression (predict LST from NDVI/NDBI/Elevation) with variable importance
  - Z-score “hot/cool spot” labeling
  - K-Means clustering (neighborhood profiles)
- Provides map layers + UI charts, and exports GeoTIFF/CSV outputs via GEE Tasks

## Run it

1. Open the **Google Earth Engine Code Editor**.
2. Copy the contents of `src/gee/urban_heat_analysis.js` into a new script.
3. Click **Run**.
4. Check:
   - **Console** for summary stats and charts
   - **Map** for layers (LST, indices, clusters, tract boundaries)
   - **Tasks** to export outputs (GeoTIFF rasters and CSV tables)

## Exports (from the script)

The default exports include:
- LST raster (GeoTIFF)
- NDVI raster (GeoTIFF)
- NDBI raster (GeoTIFF)
- Elevation raster (GeoTIFF)
- Tract-level CSV with mean values and z-scores / cluster labels

> Tip: For reproducibility, consider documenting any parameter changes you make (ROI, dates, scale, cloud threshold) in a commit message or a separate `docs/notes.md`.

## License

MIT License — see `LICENSE`.

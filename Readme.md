# Neighborhood-Scale Urban Heat Islands and Tree Canopy Inequity in Phoenix, Arizona

**Author:** Youssouf Rachid Mohamed Yacine  
**Course:** DSA8530 - Geospatial AI and Image Analysis  
**Institution:** University of Missouri (Mizzou)  
**Date:** December 2025

## 1. Project Overview
This project investigates the spatial variations of Land Surface Temperature (LST) at the neighborhood level in Phoenix, Arizona. Utilizing Landsat 8/9 imagery from Summer 2023, the study quantifies the cooling effects of vegetation (NDVI) versus the warming effects of impervious surfaces (NDBI).

The analysis employs Google Earth Engine (GEE) to perform zonal statistics, Random Forest regression, and K-Means clustering to identify heat vulnerability and profile distinct thermal environments across 434 census tracts.

## 2. Repository Structure
In accordance with the course submission guidelines, the repository is organized as follows:

* **`README.md`**: Project documentation and reproduction steps.
* **`Yacine_Youssouf Rachid Mohamed_Project_Report.pdf`**: The final IEEE-formatted research report.
* **`project files/`**: Contains the source code for the analysis.
    * `Yacine_Youssouf Rachid Mohamed_Project_GEE_Script.js`: The complete Google Earth Engine JavaScript code including preprocessing, LST retrieval, and statistical modeling.
* **`figures/`**: Contains exported charts, maps, and visualizations used in the report.
* **`output data/`**: Contains the raw geospatial outputs (GeoTIFFs) and statistical tables (CSV/Excel).

## 3. Data Sources
This project relies on publicly available satellite and vector datasets accessible via the Google Earth Engine Data Catalog.

| Dataset | GEE Asset ID | Description |
| :--- | :--- | :--- |
| **Landsat 8 Collection 2 Level 2** | `LANDSAT/LC08/C02/T1_L2` | Surface reflectance and thermal bands for LST derivation. |
| **Census Tracts** | `TIGER/2020/TRACT` | 2020 TIGER/Line Shapefiles for Maricopa County, AZ. |
| **SRTM Elevation** | `USGS/SRTMGL1_003` | Digital Elevation Model (DEM) at 30m resolution. |

## 4. Key Outputs & Results
The script generates several key outputs included in this repository:

**Geospatial Exports (GeoTIFF):**
* `Phoenix_Summer_LST_2023.tif`: Derived Land Surface Temperature map (°C).
* `Phoenix_NDVI_Map.tif` & `Phoenix_NDBI_Map.tif`: Vegetation and Built-up index maps.
* `Phoenix_Elevation_Map.tif`: Clipped elevation model for the study area.

**Statistical Data:**
* `Phoenix_Census_Tract_Heat_Analysis.csv`: A comprehensive dataset containing mean LST, NDVI, NDBI, Elevation, and Z-Scores for all 434 census tracts.

**Figures:**
* `Drivers_of_Surface Heat.png`: Random Forest variable importance plot.
* `Neighborhood_Vegetation_vs_Temperature.png`: Scatter plot showing the cooling effect of vegetation.
* `5 Year_Summer_Temperature.png`: Temporal trend analysis (2018-2023).

## 5. How to Reproduce the Analysis
To reproduce the results:

1.  **Access the Code:** Open `project_files/Yacine_Youssouf Rachid Mohamed_Project_GEE_Script.js`.
2.  **Run in GEE:** Copy the content into the [Google Earth Engine Code Editor](https://code.earthengine.google.com/) and click **Run**.
3.  **View Outputs:**
    * **Console:** Displays Pearson correlation stats, Random Forest accuracy, and charts.
    * **Map:** Visualizes LST, Clustering, and Hot/Cold spots.
    * **Tasks:** Allows export of the GeoTIFFs and CSVs listed above.

## 6. Acknowledgments
Analysis conducted for the DSA8530 course under the guidance of Dr. Hatef Dastour.
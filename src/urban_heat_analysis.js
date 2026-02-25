// =============================================================================
// PROJECT: Urban Heat & Vegetation Analysis with Google Earth Engine
// DESCRIPTION: Neighborhood-scale Land Surface Temperature (LST) analysis using Landsat
// STUDY AREA: Phoenix, Arizona (example ROI; adjust coordinates/buffer as needed)
// =============================================================================

// -----------------------------------------------------------------------------
// SECTION 1: SETUP & HELPER FUNCTIONS
// -----------------------------------------------------------------------------

// 1. Define Study Area (Phoenix, AZ)
var roi = ee.Geometry.Point([-112.0740, 33.4484]).buffer(20000);

// 2. Cloud Masking Function (Landsat Collection 2)
function maskL8sr(image) {
  var qa = image.select('QA_PIXEL');
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 4);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply scaling factors
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));

  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true)
              .updateMask(mask)
              .updateMask(saturationMask)
              .set('system:time_start', image.get('system:time_start'));
}

// -----------------------------------------------------------------------------
// SECTION 2: IMAGE ACQUISITION & PREPROCESSING
// -----------------------------------------------------------------------------

// 1. Load Collection & Filter (Summer 2023)
// FIX: Increased cloud cover allowance to 30% to account for monsoon season clouds.
var collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(roi)
    .filterDate('2023-06-01', '2023-09-30')
    .filter(ee.Filter.lt('CLOUD_COVER', 30)) 
    .map(maskL8sr);

// DEBUG: Check if we found images
print('Images found for Summer 2023:', collection.size());

// 2. Create Median Composite
var image = collection.median().clip(roi);

// 3. Water Masking (Integrated from Enhancement 3)
// We remove water bodies early so they don't skew heat statistics.
var ndwi = image.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI'); 
var waterMask = ndwi.lt(0); // Keep pixels where NDWI < 0 (Non-water)
image = image.updateMask(waterMask);

// 4. Calculate Spectral Indices (NDVI & NDBI)
var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
var ndbi = image.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI');

// 5. Calculate Emissivity (for LST)
var min = 0.2; // NDVI for bare soil
var max = 0.5; // NDVI for full vegetation
var fvc = ndvi.subtract(min).divide(0.3).max(0).min(1).rename('FVC');
var emissivity = fvc.multiply(0.004).add(0.986).rename('EM');

// 6. Calculate LST (Single Channel Algorithm)
var thermal = image.select('ST_B10').rename('Thermal');
var lst = thermal.expression(
  '(Tb / (1 + (0.00115 * Tb / 1.438) * log(Em))) - 273.15', {
    'Tb': thermal,
    'Em': emissivity
  }).rename('LST');

// 7. Load Elevation (Integrated from Enhancement 1)
var elevation = ee.Image('USGS/SRTMGL1_003').select('elevation').rename('Elevation');

// 8. Create Final Predictor Stack
// We stack LST, NDVI, NDBI, and Elevation into one image for easy sampling.
var processedImage = image.addBands(lst)
                          .addBands(ndvi)
                          .addBands(ndbi)
                          .addBands(emissivity)
                          .addBands(elevation);

// -----------------------------------------------------------------------------
// SECTION 3: CENSUS TRACT AGGREGATION
// -----------------------------------------------------------------------------

// 1. Load Census Tracts (TIGER 2020)
var tracts = ee.FeatureCollection('TIGER/2020/TRACT')
  .filter(ee.Filter.eq('STATEFP', '04')) // Arizona
  .filter(ee.Filter.eq('COUNTYFP', '013')); // Maricopa County

// 2. Clip Image to Tracts (Remove open desert)
processedImage = processedImage.clipToCollection(tracts);

// 3. Calculate Zonal Statistics
// This aggregates the pixel values into the census polygon boundaries.
var tractStats = processedImage.reduceRegions({
  collection: tracts,
  reducer: ee.Reducer.mean(),
  scale: 30,
  crs: 'EPSG:4326'
});

// 4. Filter Clean Data (Remove nulls)
var tractStatsClean = tractStats.filter(ee.Filter.notNull(['LST', 'NDVI', 'NDBI']));

print('Total Analysis Tracts (Cleaned):', tractStatsClean.size());

// -----------------------------------------------------------------------------
// SECTION 4: STATISTICAL ANALYSIS & MODELING
// -----------------------------------------------------------------------------

// --- Part A: Regression Analysis ---
// Pixel-based correlation between NDVI and LST
var correlationStats = processedImage.select(['NDVI', 'LST']).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: tracts.geometry(),
  scale: 30,
  maxPixels: 1e9
});
print('Pixel-based Pearson Correlation (r) & P-value:', correlationStats);

// Scatter plot of Tracts
var chart = ui.Chart.feature.byFeature(tractStatsClean, 'NDVI', ['LST'])
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Neighborhood Analysis: Vegetation vs. Temperature',
    hAxis: {title: 'Vegetation Index (NDVI)'},
    vAxis: {title: 'Land Surface Temperature (°C)'},
    pointSize: 3,
    trendlines: {0: {color: 'red', visibleInLegend: true}}
  });
print(chart);

// --- Part B: Random Forest (Variable Importance) ---
// Using NDVI, NDBI, and Elevation to predict LST
var trainingData = processedImage.select(['LST', 'NDVI', 'NDBI', 'Elevation']).sample({
  region: tracts.geometry(),
  scale: 30,
  numPixels: 2000,
  seed: 42
});

var rf = ee.Classifier.smileRandomForest({numberOfTrees: 100})
  .setOutputMode('REGRESSION')
  .train({
    features: trainingData,
    classProperty: 'LST',
    inputProperties: ['NDVI', 'NDBI', 'Elevation']
  });

var importance = rf.explain();
print('Random Forest Variable Importance:', importance);

var importanceChart = ui.Chart.feature.byProperty(
    ee.Feature(null, ee.Dictionary(importance).get('importance')),
    ['NDVI', 'NDBI', 'Elevation']
  )
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Drivers of Surface Heat',
    hAxis: {title: 'Predictor Variable'},
    vAxis: {title: 'Relative Importance Score'},
    colors: ['#1f77b4']
  });
print(importanceChart);

// --- Part C: Spatial Clustering (LISA / Z-Scores) ---
// Identify Hot Spots (High Z-Score) and Cool Spots (Low Z-Score)
var statsGlobal = tractStatsClean.reduceColumns({
  reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), null, true),
  selectors: ['LST']
});

var meanLST = ee.Number(statsGlobal.get('mean'));
var stdLST = ee.Number(statsGlobal.get('stdDev'));

var lisaClassified = tractStatsClean.map(function(feat) {
  var lst = ee.Number(feat.get('LST'));
  var zScore = lst.subtract(meanLST).divide(stdLST);
  // 2 = Hot Spot (> 1.5 std), 1 = Cool Spot (< -1.5 std), 0 = Neutral
  var type = ee.Algorithms.If(zScore.gt(1.5), 2, 
             ee.Algorithms.If(zScore.lt(-1.5), 1, 0));
  return feat.set('cluster_type', type).set('z_score', zScore);
});

// --- Part D: K-Means Clustering (Unsupervised) ---
// Group neighborhoods into 3 distinct profiles based on biophysical traits
var clusterer = ee.Clusterer.wekaKMeans(3).train({
  features: tractStatsClean.select(['LST', 'NDVI', 'NDBI']),
  inputProperties: ['LST', 'NDVI', 'NDBI']
});
var clusteredTracts = tractStatsClean.cluster(clusterer);

// --- Part E: Histogram of Surface Temperatures across Census Tracts ---
var histChart = ui.Chart.feature.histogram({
  features: tractStatsClean,
  property: 'LST',
  minBucketWidth: 1
}).setOptions({
  title: 'Distribution of Neighborhood Temperatures',
  hAxis: {title: 'Land Surface Temperature (°C)'},
  vAxis: {title: 'Count of Neighborhoods'},
  colors: ['red'],
  legend: {position: 'none'}
});

print('LST Distribution Histogram:', histChart);

// --- Part F: Spatial Trend Plot (Latitude vs LST) ---
// This visually demonstrates if heat is clustered North-South or Randomly
var latChart = ui.Chart.feature.byFeature(tractStatsClean, 'INTPTLAT', ['LST']) // INTPTLAT is standard Census latitude
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Spatial Trend: Latitude vs. Temperature',
    hAxis: {title: 'Latitude (North-South)'},
    vAxis: {title: 'Temperature (°C)'},
    pointSize: 2,
    trendlines: {0: {color: 'red', visibleInLegend: true}}
  });

print('Spatial Autocorrelation Check (Lat vs LST):', latChart);

// -----------------------------------------------------------------------------
// SECTION 5: TIME SERIES ANALYSIS (2018-2023)
// -----------------------------------------------------------------------------
// Integrated from Enhancement 4

// FIX: Increased cloud cover allowance to 30% here as well.
var timeSeriesCol = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(tracts.geometry())
    .filter(ee.Filter.calendarRange(6, 9, 'month')) // Summer months only
    .filterDate('2018-01-01', '2023-12-30')
    .filter(ee.Filter.lt('CLOUD_COVER', 30)) 
    .map(maskL8sr);

print('Time Series Images found:', timeSeriesCol.size());

var trendChart = ui.Chart.image.series({
  imageCollection: timeSeriesCol.select(['ST_B10']),
  region: roi,
  reducer: ee.Reducer.mean(),
  scale: 100
}).setOptions({
  title: '5-Year Summer Temperature Trend in Phoenix',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Raw Surface Temp (Kelvin/Unscaled)'}, // Note: raw band used for trend
  lineWidth: 2,
  pointSize: 3,
  trendlines: {0: {color: 'red'}}
});
print(trendChart);

// -----------------------------------------------------------------------------
// SECTION 6: VISUALIZATION & MAPPING
// -----------------------------------------------------------------------------

Map.centerObject(roi, 11);
Map.setOptions('SATELLITE');

// 1. True Color
Map.addLayer(image, {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.3}, 'Phoenix True Color', false);

// 2. LST Map
var lstVis = {min: 30, max: 60, palette: ['blue', 'cyan', 'green', 'yellow', 'red']};
Map.addLayer(processedImage.select('LST'), lstVis, 'Land Surface Temperature (°C)');

// 3. Elevation Map
// We take the Elevation band and force a clip to your 'roi' geometry
var elevationLayer = processedImage.select('Elevation').clip(roi);

var elevVis = {min: 300, max: 600, palette: ['black', 'gray', 'white']};
Map.addLayer(elevationLayer, elevVis, 'Elevation (SRTM - Meters)', false);

// 4. NDVI (Vegetation) - Green Palette
var ndviVis = {min: 0, max: 0.5, palette: ['white', 'green']};
Map.addLayer(processedImage.select('NDVI'), ndviVis, 'Vegetation Density (NDVI)', false);

// 5. NDBI (Impervious Surfaces) - Red Palette
var ndbiVis = {min: -0.2, max: 0.2, palette: ['white', 'red']};
Map.addLayer(processedImage.select('NDBI'), ndbiVis, 'Built-Up Intensity (NDBI)', false);

// 6. Hot/Cold Spots (LISA)
var clusterImage = ee.Image().byte().paint({
  featureCollection: lisaClassified,
  color: 'cluster_type'
});
Map.addLayer(clusterImage, {palette: ['lightgrey', 'blue', 'red'], min: 0, max: 2}, 'LST Anomalies (Z-Score)');

// 7. K-Means Profiles
var kMeansImg = ee.Image().byte().paint(clusteredTracts, 'cluster');
Map.addLayer(kMeansImg, {min: 0, max: 2, palette: ['red', 'yellow', 'green']}, 'Neighborhood Profiles (K-Means)', false);

// 8. Tract Boundaries
var empty = ee.Image().byte();
var tractOutlines = empty.paint({featureCollection: tractStatsClean, color: 1, width: 1});
Map.addLayer(tractOutlines, {palette: 'black'}, 'Census Tracts');

// --- Map Legend ---
var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px 15px'}});
var legendTitle = ui.Label({
  value: 'Summer LST (°C)',
  style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0', padding: '0'}
});
legend.add(legendTitle);
var lon = ee.Image.pixelLonLat().select('latitude');
var gradient = lon.multiply((60 - 30)/100.0).add(30);
var legendImage = gradient.visualize({min: 30, max: 60, palette: ['blue', 'cyan', 'green', 'yellow', 'red']});
var panel = ui.Panel({
    widgets: [ui.Label('60°C'), ui.Label({style: {stretch: 'horizontal'}}), ui.Label('30°C')],
    layout: ui.Panel.Layout.flow('horizontal')
  });
legend.add(panel);
legend.add(ui.Thumbnail(legendImage, {bbox: '0,0,10,100', dimensions: '200x20'}));
Map.add(legend);

// -----------------------------------------------------------------------------
// SECTION 7: EXPORTS
// -----------------------------------------------------------------------------

// 1. Export LST Map
Export.image.toDrive({
  image: processedImage.select('LST'),
  description: 'Phoenix_Summer_LST_2023',
  scale: 30,
  region: roi,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF'
});

// 2. Export Tract Data (Includes LST, Indices, Z-Scores, Clusters)
// We join the data so you have one master CSV
Export.table.toDrive({
  collection: lisaClassified,
  description: 'Phoenix_Census_Tract_Heat_Analysis',
  fileFormat: 'CSV',
  selectors: ['GEOID', 'LST', 'NDVI', 'NDBI', 'z_score', 'cluster_type']
});

// 3. Export Elevation Map (Clipped)
Export.image.toDrive({
  image: elevationLayer, 
  description: 'Phoenix_Elevation_Map',
  scale: 30,
  region: roi,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF'
});

// 4. Export NDVI
Export.image.toDrive({
  image: processedImage.select('NDVI'),
  description: 'Phoenix_NDVI_Map',
  scale: 30,
  region: roi,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF'
});

// 5. Export NDBI
Export.image.toDrive({
  image: processedImage.select('NDBI'),
  description: 'Phoenix_NDBI_Map',
  scale: 30,
  region: roi,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF'
});
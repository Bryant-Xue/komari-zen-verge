/**
 * Build-time generator: Natural Earth land → dot grid + country centroids.
 * Run: node scripts/generate-world-map.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  geoContains,
  geoCentroid,
  geoGraticule10,
  geoNaturalEarth1,
  geoPath,
} from "d3-geo";
import { feature } from "topojson-client";
import iso31661 from "iso-3166-1";
import countriesTopology from "world-atlas/countries-50m.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../src/assets/world-map-data.json");

const WIDTH = 1000;
const HEIGHT = 500;
/** Grid spacing in degrees — finer = more dots, still ~3k land points */
const GRID_STEP = 1.15;

/** Region-status map (Deer-style country fills) uses a taller canvas. */
const REGION_MAP_WIDTH = 1000;
const REGION_MAP_HEIGHT = 560;
const REGION_HORIZONTAL_PADDING = 28;
const REGION_TOP_PADDING = 42;
const REGION_BOTTOM_INSET = 42;
const SMALL_REGION_MARKER_AREA_THRESHOLD = 14;
const SMALL_REGION_MARKER_SIZE_THRESHOLD = 7;

/** ISO alpha-2 → [lng, lat] for codes absent from Natural Earth 50m */
const MANUAL_COORDS = {
  AC: [-14.3559, -7.9467],
  BQ: [-68.27, 12.17],
  BV: [3.38, -54.42],
  CC: [96.87, -12.17],
  CP: [-72.526, -33.393],
  CX: [105.63, -10.47],
  DG: [72.4, -7.3],
  EA: [-5.3, 35.9],
  EU: [4.47, 50.5],
  GF: [-53.0, 3.93],
  GI: [-5.35, 36.14],
  GP: [-61.55, 16.25],
  IC: [-16.5, 28.0],
  MQ: [-61.0, 14.67],
  RE: [55.54, -21.11],
  SJ: [11.0, 78.0],
  TA: [-15.935, -54.367],
  TK: [-171.85, -9.17],
  TV: [179.2, -8.52],
  UM: [-160.0, 0.0],
  UN: [0, 51.5],
  XK: [20.9, 42.6],
  YT: [45.17, -12.83],
};

const land = feature(countriesTopology, countriesTopology.objects.land);
const countries = feature(countriesTopology, countriesTopology.objects.countries);

const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 6],
    [WIDTH - 8, HEIGHT - 6],
  ],
  land,
);

const dots = [];
for (let lat = -60; lat <= 84; lat += GRID_STEP) {
  for (let lng = -180; lng < 180; lng += GRID_STEP) {
    if (!geoContains(land, [lng, lat])) continue;
    const p = projection([lng, lat]);
    if (!p) continue;
    const [x, y] = p;
    if (x < 0 || y < 0 || x > WIDTH || y > HEIGHT) continue;
    dots.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  }
}

/** ISO 3166-1 alpha-2 → projected centroid [x, y] (50m for small territories) */
const centroids = {};
for (const f of countries.features) {
  const numericId = String(f.id ?? "");
  const entry = iso31661.whereNumeric(numericId);
  if (!entry?.alpha2) continue;
  const c = geoCentroid(f);
  const p = projection(c);
  if (!p) continue;
  centroids[entry.alpha2] = [
    Math.round(p[0] * 10) / 10,
    Math.round(p[1] * 10) / 10,
  ];
}

for (const [code, coord] of Object.entries(MANUAL_COORDS)) {
  if (centroids[code]) continue;
  const p = projection(coord);
  if (!p) continue;
  centroids[code] = [
    Math.round(p[0] * 10) / 10,
    Math.round(p[1] * 10) / 10,
  ];
}

const payload = {
  w: WIDTH,
  h: HEIGHT,
  dots,
  centroids,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));

const dotCount = dots.length / 2;
const centroidCount = Object.keys(centroids).length;
console.log(
  `Wrote ${outPath}\n  land dots: ${dotCount}\n  country centroids: ${centroidCount}\n  size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`,
);

const regionProjection = geoNaturalEarth1().fitExtent(
  [
    [REGION_HORIZONTAL_PADDING, REGION_TOP_PADDING],
    [
      REGION_MAP_WIDTH - REGION_HORIZONTAL_PADDING,
      REGION_MAP_HEIGHT - REGION_BOTTOM_INSET,
    ],
  ],
  countries,
);
const regionPath = geoPath(regionProjection);

const regionCountries = countries.features
  .map((country) => {
    const name = country.properties?.name ?? String(country.id ?? "unknown");
    const pathData = regionPath(country) ?? "";
    const bounds = regionPath.bounds(country);
    const width = bounds[1][0] - bounds[0][0];
    const height = bounds[1][1] - bounds[0][1];
    const area = regionPath.area(country);
    const marker = regionPath.centroid(country);
    const shouldShowMarker =
      Number.isFinite(marker[0]) &&
      Number.isFinite(marker[1]) &&
      (area < SMALL_REGION_MARKER_AREA_THRESHOLD ||
        Math.max(width, height) < SMALL_REGION_MARKER_SIZE_THRESHOLD);

    return {
      name,
      pathData,
      bounds: [
        Math.round(bounds[0][0] * 10) / 10,
        Math.round(bounds[0][1] * 10) / 10,
        Math.round(bounds[1][0] * 10) / 10,
        Math.round(bounds[1][1] * 10) / 10,
      ],
      smallRegionMarker: shouldShowMarker
        ? {
            x: Math.round(marker[0] * 100) / 100,
            y: Math.round(marker[1] * 100) / 100,
          }
        : null,
    };
  })
  .filter((country) => country.pathData);

const regionPayload = {
  w: REGION_MAP_WIDTH,
  h: REGION_MAP_HEIGHT,
  spherePath: regionPath({ type: "Sphere" }) ?? "",
  graticulePath: regionPath(geoGraticule10()) ?? "",
  countries: regionCountries,
};

const regionOutPath = path.resolve(
  __dirname,
  "../src/assets/world-map-countries.json",
);
fs.writeFileSync(regionOutPath, JSON.stringify(regionPayload));

console.log(
  `Wrote ${regionOutPath}\n  countries: ${regionCountries.length}\n  size: ${(
    fs.statSync(regionOutPath).size / 1024
  ).toFixed(1)} KB`,
);

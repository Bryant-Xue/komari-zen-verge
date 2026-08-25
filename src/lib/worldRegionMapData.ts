/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import raw from "@/assets/world-map-countries.json";

export type RegionWorldMapCountry = {
  name: string;
  pathData: string;
  bounds: [number, number, number, number];
  smallRegionMarker: { x: number; y: number } | null;
};

export type RegionWorldMapData = {
  w: number;
  h: number;
  spherePath: string;
  graticulePath: string;
  countries: RegionWorldMapCountry[];
};

export const worldRegionMapData = raw as unknown as RegionWorldMapData;

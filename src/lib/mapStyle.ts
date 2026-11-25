import type { StyleSpecification } from 'maplibre-gl';
import { CONTEXT_3D_HEIGHT_M, FLOOR_HEIGHT_M } from './constants';
import type { RoadsGeoJSONResult } from './geo';

interface CreateStyleParams {
  buildings: GeoJSON.FeatureCollection;
  roads: RoadsGeoJSONResult;
  contextGeoJSON: GeoJSON.FeatureCollection | null;
  context3DGeoJSON: GeoJSON.FeatureCollection | null;
}

/**
 * Custom MapLibre GL style with NO external tiles and NO glyphs.
 * Includes both 2D flat layers (default visible) and 3D pastel fill-extrusion
 * layers (default hidden), toggled cleanly without rebuilding sources.
 */
export function createPastelMapStyle({
  buildings,
  roads,
  contextGeoJSON,
  context3DGeoJSON,
}: CreateStyleParams): StyleSpecification {
  const sources: StyleSpecification['sources'] = {
    'roads-regular': {
      type: 'geojson',
      data: roads.regularRoads,
    },
    'roads-manual': {
      type: 'geojson',
      data: roads.manualRoads,
    },
    buildings: {
      type: 'geojson',
      data: buildings,
    },
    route: {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    },
    'route-entrance': {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    },
  };

  const layers: StyleSpecification['layers'] = [
    {
      id: 'map-background',
      type: 'background',
      paint: {
        'background-color': '#EEF1F0',
      },
    },
  ];

  if (contextGeoJSON) {
    sources['context-buildings'] = {
      type: 'geojson',
      data: contextGeoJSON,
    };
    layers.push({
      id: 'context-buildings-fill',
      type: 'fill',
      source: 'context-buildings',
      layout: { visibility: 'visible' },
      paint: {
        'fill-color': '#E8EBEA',
        'fill-opacity': 1,
      },
    });
  }

  if (context3DGeoJSON) {
    sources['context-3d'] = {
      type: 'geojson',
      data: context3DGeoJSON,
    };
  }

  layers.push(
    {
      id: 'roads-casing',
      type: 'line',
      source: 'roads-regular',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#E2E7E5',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          5,
          17,
          10,
          20,
          22,
        ],
      },
    },
    {
      id: 'roads-fill',
      type: 'line',
      source: 'roads-regular',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          3.5,
          17,
          8,
          20,
          18,
        ],
      },
    },
    {
      id: 'roads-manual-dashed',
      type: 'line',
      source: 'roads-manual',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#C9D3D0',
        'line-dasharray': [2, 2.5],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          1.5,
          17,
          2.5,
          20,
          4.5,
        ],
      },
    },
    // --- 2D Building Layers (hidden in 3D to prevent z-fighting) ---
    {
      id: 'buildings-fill',
      type: 'fill',
      source: 'buildings',
      layout: { visibility: 'visible' },
      paint: {
        'fill-color': '#E1E5E4',
        'fill-opacity': 1,
      },
    },
    {
      id: 'buildings-edge',
      type: 'line',
      source: 'buildings',
      layout: { visibility: 'visible' },
      paint: {
        'line-color': '#D5DAD8',
        'line-width': 1,
      },
    },
    {
      id: 'buildings-selected-fill',
      type: 'fill',
      source: 'buildings',
      layout: { visibility: 'visible' },
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'fill-color': '#C5F1E1',
        'fill-opacity': 1,
      },
    },
    {
      id: 'buildings-selected-edge',
      type: 'line',
      source: 'buildings',
      layout: { visibility: 'visible' },
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'line-color': '#2ED39A',
        'line-width': 2.2,
      },
    }
  );

  // --- 3D Fill-Extrusion Layers (hidden in 2D) ---
  if (context3DGeoJSON) {
    layers.push({
      id: 'context-3d',
      type: 'fill-extrusion',
      source: 'context-3d',
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': '#E8EBEA',
        'fill-extrusion-height': CONTEXT_3D_HEIGHT_M,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }

  layers.push(
    {
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: 'buildings',
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': [
          'match',
          ['get', 'category'],
          'admin',
          '#BFE8D8',
          'faculty',
          '#C9D3F0',
          'facility',
          '#F7DDB0',
          'food',
          '#F8C9B8',
          'event',
          '#F3C6D8',
          '#DDE6E2',
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'estimatedHeightM'], 14],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'selected-floor-3d',
      type: 'fill-extrusion',
      source: 'buildings',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'fill-extrusion-color': '#2ED39A',
        'fill-extrusion-base': 0,
        'fill-extrusion-height': FLOOR_HEIGHT_M,
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // --- Dotted Route Layers (ALWAYS above 3D extrusion layers) ---
    {
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 9,
      },
    },
    {
      id: 'route-line-regular',
      type: 'line',
      source: 'route',
      filter: ['!=', ['get', 'manual'], true],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#2ED39A',
        'line-width': 5,
        'line-dasharray': [0, 2],
      },
    },
    {
      id: 'route-line-manual',
      type: 'line',
      source: 'route',
      filter: ['==', ['get', 'manual'], true],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#9ADFC4',
        'line-width': 5,
        'line-dasharray': [1.5, 2],
      },
    },
    {
      id: 'route-entrance-dot',
      type: 'circle',
      source: 'route-entrance',
      paint: {
        'circle-radius': 6,
        'circle-color': '#FF8A3D',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#FFFFFF',
      },
    }
  );

  return {
    version: 8,
    sources,
    layers,
  };
}

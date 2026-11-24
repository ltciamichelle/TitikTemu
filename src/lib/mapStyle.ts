import type { StyleSpecification } from 'maplibre-gl';
import type { BuildingsGeoJSON } from '../types';
import type { RoadsGeoJSONResult } from './geo';

interface CreateStyleParams {
  buildings: BuildingsGeoJSON;
  roads: RoadsGeoJSONResult;
  contextGeoJSON: GeoJSON.FeatureCollection | null;
}

/**
 * Custom MapLibre GL style with NO external tiles and NO glyphs.
 * All labels and pins are rendered as HTML markers.
 */
export function createPastelMapStyle({
  buildings,
  roads,
  contextGeoJSON,
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
      data: buildings as unknown as GeoJSON.FeatureCollection,
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
      paint: {
        'fill-color': '#E8EBEA',
        'fill-opacity': 1,
      },
    });
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
    {
      id: 'buildings-fill',
      type: 'fill',
      source: 'buildings',
      paint: {
        'fill-color': '#E1E5E4',
        'fill-opacity': 1,
      },
    },
    {
      id: 'buildings-edge',
      type: 'line',
      source: 'buildings',
      paint: {
        'line-color': '#D5DAD8',
        'line-width': 1,
      },
    },
    {
      id: 'buildings-selected-fill',
      type: 'fill',
      source: 'buildings',
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
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'line-color': '#2ED39A',
        'line-width': 2.2,
      },
    },
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

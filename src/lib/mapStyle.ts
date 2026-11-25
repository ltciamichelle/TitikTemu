import type { StyleSpecification } from 'maplibre-gl';
import { CONTEXT_3D_HEIGHT_M, FLOOR_HEIGHT_M } from './constants';
import type { RoadsGeoJSONResult } from './geo';
import type { IllustratedAssets } from './illustrated';

interface CreateStyleParams {
  buildings: GeoJSON.FeatureCollection;
  roads: RoadsGeoJSONResult;
  contextGeoJSON: GeoJSON.FeatureCollection | null;
  context3DGeoJSON: GeoJSON.FeatureCollection | null;
  illustrated?: IllustratedAssets | null;
}

/**
 * Custom MapLibre GL style with NO external tiles and NO glyphs.
 * Supports Flat (2D, Overview 3D, Nav 3D) and Illustrated decorative layers,
 * toggled via visibility without rebuilding sources.
 */
export function createPastelMapStyle({
  buildings,
  roads,
  contextGeoJSON,
  context3DGeoJSON,
  illustrated = null,
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
    'route-done': {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    },
    'route-entrance': {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    },
  };

  if (contextGeoJSON) {
    sources['context-buildings'] = {
      type: 'geojson',
      data: contextGeoJSON,
    };
  }
  if (context3DGeoJSON) {
    sources['context-3d'] = {
      type: 'geojson',
      data: context3DGeoJSON,
    };
  }

  if (illustrated) {
    sources['ill-paving'] = { type: 'geojson', data: illustrated.paving };
    sources['ill-shadows-2d'] = {
      type: 'geojson',
      data: illustrated.shadows2D,
    };
    sources['ill-shadows-3d'] = {
      type: 'geojson',
      data: illustrated.shadows3D,
    };
    sources['ill-building-bands'] = {
      type: 'geojson',
      data: illustrated.buildingBands,
    };
    sources['ill-building-roofs'] = {
      type: 'geojson',
      data: illustrated.buildingRoofs,
    };
    sources['ill-context-3d'] = {
      type: 'geojson',
      data: illustrated.contextExtrusions,
    };
    sources['ill-context-roofs'] = {
      type: 'geojson',
      data: illustrated.contextRoofs,
    };
    sources['ill-tree-grass'] = {
      type: 'geojson',
      data: illustrated.treeGrass,
    };
    sources['ill-tree-trunks'] = {
      type: 'geojson',
      data: illustrated.treeTrunks,
    };
    sources['ill-tree-canopies'] = {
      type: 'geojson',
      data: illustrated.treeCanopies,
    };
  }

  const layers: StyleSpecification['layers'] = [
    {
      id: 'map-background',
      type: 'background',
      paint: {
        'background-color': illustrated ? '#EFF3EC' : '#EEF1F0',
      },
    },
  ];

  // Illustrated ground paving + faint grass circles under trees (below roads & buildings)
  if (illustrated) {
    layers.push(
      {
        id: 'ill-paving-fill',
        type: 'fill',
        source: 'ill-paving',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#E8EDE6',
          'fill-opacity': 1,
        },
      },
      {
        id: 'ill-tree-grass',
        type: 'circle',
        source: 'ill-tree-grass',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#DDEBD6',
          'circle-opacity': 0.5,
          'circle-radius': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            15,
            2,
            17,
            8,
            19,
            32,
          ],
          'circle-pitch-alignment': 'map',
        },
      }
    );
  }

  if (contextGeoJSON) {
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

  // Warm curb edge along roads (Illustrated mode only)
  if (illustrated) {
    layers.push({
      id: 'ill-roads-curb',
      type: 'line',
      source: 'roads-regular',
      layout: {
        visibility: 'none',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#E3DCCB',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          7,
          17,
          12,
          20,
          24,
        ],
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
    }
  );

  // Soft shadows BELOW buildings (Illustrated 2D and 3D)
  if (illustrated) {
    layers.push(
      {
        id: 'ill-shadows-2d',
        type: 'fill',
        source: 'ill-shadows-2d',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#1E2A3A',
          'fill-opacity': 0.14,
          'fill-translate': [0, 0],
        },
      },
      {
        id: 'ill-shadows-3d',
        type: 'fill',
        source: 'ill-shadows-3d',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#1E2A3A',
          'fill-opacity': 0.14,
          'fill-translate': [0, 0],
        },
      }
    );
  }

  // --- 2D Building Layers ---
  layers.push(
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

  // 2D flat soft tree canopies (Illustrated 2D only)
  if (illustrated) {
    layers.push({
      id: 'ill-tree-canopies-2d',
      type: 'fill',
      source: 'ill-tree-canopies',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.88,
      },
    });
  }

  // --- Flat 3D Fill-Extrusion Layers ---
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

  layers.push({
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
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  });

  // Flat 3D non-overlapping lower/upper segments around the selected floor slab
  layers.push(
    {
      id: 'buildings-3d-below',
      type: 'fill-extrusion',
      source: 'buildings',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'fill-extrusion-color': '#8FE3C3',
        'fill-extrusion-base': 0,
        'fill-extrusion-height': 0,
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'buildings-3d-above',
      type: 'fill-extrusion',
      source: 'buildings',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'fill-extrusion-color': '#8FE3C3',
        'fill-extrusion-base': FLOOR_HEIGHT_M,
        'fill-extrusion-height': ['coalesce', ['get', 'estimatedHeightM'], 14],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    }
  );

  // --- Illustrated 3D Decorative Layers (context pastels + roofs, UNTAR floor bands + roofs, 3D trees) ---
  if (illustrated) {
    layers.push(
      {
        id: 'ill-context-3d',
        type: 'fill-extrusion',
        source: 'ill-context-3d',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'ill-context-roofs',
        type: 'fill-extrusion',
        source: 'ill-context-roofs',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'ill-building-bands',
        type: 'fill-extrusion',
        source: 'ill-building-bands',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'ill-building-selected-glow',
        type: 'line',
        source: 'buildings',
        layout: { visibility: 'none' },
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'line-color': '#EF4444',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      },
      {
        id: 'ill-building-roofs',
        type: 'fill-extrusion',
        source: 'ill-building-roofs',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'ill-tree-trunks',
        type: 'fill-extrusion',
        source: 'ill-tree-trunks',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 1,
        },
      },
      {
        id: 'ill-tree-canopies-3d',
        type: 'fill-extrusion',
        source: 'ill-tree-canopies',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': true,
        },
      }
    );
  }

  // --- Selected Floor Slab (Red indicator) & Nav3D Destination Highlight ---
  layers.push(
    {
      id: 'selected-floor-3d',
      type: 'fill-extrusion',
      source: 'buildings',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'fill-extrusion-color': '#EF4444',
        'fill-extrusion-base': 0,
        'fill-extrusion-height': FLOOR_HEIGHT_M,
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'nav-dest-building-3d',
      type: 'fill-extrusion',
      source: 'buildings',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'fill-extrusion-color': '#8FE3C3',
        'fill-extrusion-height': ['coalesce', ['get', 'estimatedHeightM'], 14],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'nav-dest-edge-3d',
      type: 'line',
      source: 'buildings',
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'line-color': '#2ED39A',
        'line-width': 2.5,
      },
    },
    // --- Route Layers (ALWAYS above all decorative & extrusion layers) ---
    {
      id: 'route-done',
      type: 'line',
      source: 'route-done',
      layout: {
        visibility: 'none',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#BFE8D8',
        'line-width': 6,
      },
    },
    {
      id: 'route-glow',
      type: 'line',
      source: 'route',
      filter: ['!=', ['get', 'manual'], true],
      layout: {
        visibility: 'none',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#2ED39A',
        'line-width': 18,
        'line-opacity': 0.25,
        'line-blur': 8,
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
      id: 'route-core',
      type: 'line',
      source: 'route',
      filter: ['!=', ['get', 'manual'], true],
      layout: {
        visibility: 'none',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#2ED39A',
        'line-width': 6,
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

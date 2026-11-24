import type { PaddingOptions } from 'maplibre-gl';
import type { Breakpoint } from '../hooks/useMediaQuery';
import type {
  Building,
  BuildingInfoMap,
  BuildingsGeoJSON,
  LngLat,
  PathsGraph,
  SearchResultItem,
} from '../types';

export const CAMPUS_CENTER: LngLat = [106.789722, -6.168985];
export const INITIAL_ZOOM = 17;
export const MIN_ZOOM = 15;
export const MAX_ZOOM = 20;

/**
 * Fixed demo user position near the main campus road (node n3, west of Gedung I).
 * Stored as a constant so browser geolocation can replace it later.
 */
export const DEMO_USER_POSITION: LngLat = [106.7887265, -6.1687792];

export const SIDEBAR_WIDTH_DESKTOP = 400;
export const SIDEBAR_WIDTH_TABLET = 340;
export const SIDEBAR_MARGIN_TABLET = 16;

/**
 * Compute responsive MapLibre camera padding so all buildings and the "You"
 * marker stay centered in the visible map area (never behind sidebar or sheets).
 */
export function getMapPadding(
  breakpoint: Breakpoint,
  hasSelection: boolean
): PaddingOptions {
  if (breakpoint === 'desktop') {
    return {
      top: 56,
      bottom: 64,
      left: SIDEBAR_WIDTH_DESKTOP + 40,
      right: 84,
    };
  }
  if (breakpoint === 'tablet') {
    return {
      top: 56,
      bottom: 64,
      left: SIDEBAR_WIDTH_TABLET + SIDEBAR_MARGIN_TABLET + 40,
      right: 84,
    };
  }
  return {
    top: 100,
    bottom: hasSelection ? 260 : 160,
    left: 24,
    right: 24,
  };
}

/**
 * Compute bounding box [[minLng, minLat], [maxLng, maxLat]] covering
 * all 6 campus buildings AND the fixed user dot.
 */
export function computeCampusBounds(
  buildings: Building[],
  userPos: LngLat
): [LngLat, LngLat] {
  let minLng = userPos[0];
  let maxLng = userPos[0];
  let minLat = userPos[1];
  let maxLat = userPos[1];

  for (const b of buildings) {
    for (const ring of b.polygon) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * Compute visual centroid of a polygon's outer ring using the shoelace formula.
 */
export function computePolygonCentroid(ring: LngLat[]): LngLat {
  if (ring.length === 0) return CAMPUS_CENTER;

  let area2 = 0;
  let cx = 0;
  let cy = 0;
  const n = ring.length;

  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  if (Math.abs(area2) < 1e-12) {
    const count = n > 1 ? n - 1 : n;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < count; i++) {
      sumX += ring[i][0];
      sumY += ring[i][1];
    }
    return [sumX / count, sumY / count];
  }

  return [cx / (3 * area2), cy / (3 * area2)];
}

/**
 * Format shortName into compact initials for round pins (e.g. "J dan L" -> "J&L").
 */
export function formatPinInitials(shortName: string): string {
  const trimmed = shortName.trim();
  if (/dan/i.test(trimmed)) {
    return trimmed.replace(/\s+dan\s+/i, '&');
  }
  return trimmed;
}

export function extractBuildings(
  geojson: BuildingsGeoJSON,
  infoMap: BuildingInfoMap = {}
): Building[] {
  return geojson.features.map((feature) => {
    const props = feature.properties;
    const extra = infoMap[props.id];

    return {
      ...props,
      category: props.category ?? extra?.category ?? null,
      hours: props.hours ?? extra?.hours ?? null,
      description: props.description ?? extra?.description ?? null,
      photo: props.photo ?? extra?.photo ?? null,
      rooms: extra?.rooms ?? {},
      polygon: feature.geometry.coordinates,
      centroid: computePolygonCentroid(feature.geometry.coordinates[0] ?? []),
    };
  });
}

export interface RoadsGeoJSONResult {
  regularRoads: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  manualRoads: GeoJSON.FeatureCollection<GeoJSON.LineString>;
}

/**
 * Build GeoJSON LineString collections from paths.json edges strictly between
 * nodes of type "junction" (skipping entrance stubs).
 */
export function buildRoadsGeoJSON(graph: PathsGraph): RoadsGeoJSONResult {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const regularFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const manualFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  for (const edge of graph.edges) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) continue;
    if (fromNode.type !== 'junction' || toNode.type !== 'junction') continue;

    const feature: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {
        from: edge.from,
        to: edge.to,
        meters: edge.meters,
        manual: Boolean(edge.manual),
      },
      geometry: {
        type: 'LineString',
        coordinates: [fromNode.coord, toNode.coord],
      },
    };

    if (edge.manual) {
      manualFeatures.push(feature);
    } else {
      regularFeatures.push(feature);
    }
  }

  return {
    regularRoads: { type: 'FeatureCollection', features: regularFeatures },
    manualRoads: { type: 'FeatureCollection', features: manualFeatures },
  };
}

/**
 * Case-insensitive search matching building name, shortName, formatted initials,
 * AND room names from buildingInfo.json.
 */
export function searchBuildings(
  buildings: Building[],
  rawQuery: string
): SearchResultItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return buildings.map((building) => ({ building }));
  }

  const results: SearchResultItem[] = [];

  for (const b of buildings) {
    const name = b.name.toLowerCase();
    const shortName = b.shortName.toLowerCase();
    const initials = formatPinInitials(b.shortName).toLowerCase();

    // Check room name matches across all floors
    let matchedRoom: { floor: number; name: string } | undefined;
    for (const [floorKey, roomList] of Object.entries(b.rooms)) {
      const found = roomList.find((room) => room.toLowerCase().includes(q));
      if (found) {
        const parsedFloor = Number.parseInt(floorKey, 10);
        matchedRoom = {
          floor: Number.isNaN(parsedFloor) ? 1 : parsedFloor,
          name: found,
        };
        break;
      }
    }

    const matchesBuilding =
      name.includes(q) || shortName.includes(q) || initials.includes(q);

    if (matchesBuilding || matchedRoom) {
      results.push({ building: b, matchedRoom });
    }
  }

  return results;
}

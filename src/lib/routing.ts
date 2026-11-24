import buildingsRaw from '../data/buildings.geojson?raw';
import pathsData from '../data/paths.json';
import type {
  Building,
  BuildingsGeoJSON,
  LngLat,
  PathNode,
  PathsGraph,
} from '../types';

export interface GraphEdge {
  to: string;
  meters: number;
  manual: boolean;
}

export interface RoutingGraph {
  nodes: Map<string, PathNode>;
  adjacency: Map<string, GraphEdge[]>;
  walkSpeedMPerMin: number;
}

export interface RouteSegment {
  coords: [LngLat, LngLat];
  manual: boolean;
}

export interface RouteResult {
  nodeIds: string[];
  coords: LngLat[];
  segments: RouteSegment[];
  meters: number;
  minutes: number;
  usesManual: boolean;
  snapDistanceM?: number;
  destinationBuildingId?: string;
  destinationEntrance?: LngLat;
}

export interface SnapResult {
  nodeId: string;
  distanceM: number;
}

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6371000;

/**
 * Local equirectangular distance approximation in meters (accurate at campus scale).
 */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const avgLatRad = ((a[1] + b[1]) / 2) * DEG_TO_RAD;
  const dx =
    (b[0] - a[0]) * DEG_TO_RAD * Math.cos(avgLatRad) * EARTH_RADIUS_M;
  const dy = (b[1] - a[1]) * DEG_TO_RAD * EARTH_RADIUS_M;
  return Math.hypot(dx, dy);
}

/**
 * Check if a coordinate falls within the bounding box of the 6 buildings plus marginM meters.
 */
export function isInsideCampusArea(
  lngLat: LngLat,
  buildings: Building[],
  marginM = 150
): boolean {
  if (buildings.length === 0) return false;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

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

  const avgLatRad = ((minLat + maxLat) / 2) * DEG_TO_RAD;
  const latMarginDeg = marginM / (EARTH_RADIUS_M * DEG_TO_RAD);
  const lngMarginDeg =
    marginM / (EARTH_RADIUS_M * Math.cos(avgLatRad) * DEG_TO_RAD);

  return (
    lngLat[0] >= minLng - lngMarginDeg &&
    lngLat[0] <= maxLng + lngMarginDeg &&
    lngLat[1] >= minLat - latMarginDeg &&
    lngLat[1] <= maxLat + latMarginDeg
  );
}

/**
 * Build an undirected adjacency-list graph from paths.json.
 */
export function buildGraph(paths: PathsGraph): RoutingGraph {
  const nodes = new Map<string, PathNode>();
  const adjacency = new Map<string, GraphEdge[]>();

  for (const node of paths.nodes) {
    nodes.set(node.id, node);
    adjacency.set(node.id, []);
  }

  for (const edge of paths.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    const manual = Boolean(edge.manual);
    adjacency.get(edge.from)!.push({ to: edge.to, meters: edge.meters, manual });
    adjacency.get(edge.to)!.push({ to: edge.from, meters: edge.meters, manual });
  }

  return {
    nodes,
    adjacency,
    walkSpeedMPerMin: paths.walkSpeedMPerMin || 80,
  };
}

interface HeapItem {
  id: string;
  dist: number;
}

class MinHeap {
  private items: HeapItem[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: HeapItem): void {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): HeapItem | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.items[idx].dist >= this.items[parent].dist) break;
      [this.items[idx], this.items[parent]] = [
        this.items[parent],
        this.items[idx],
      ];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const n = this.items.length;
    while (true) {
      let smallest = idx;
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      if (left < n && this.items[left].dist < this.items[smallest].dist) {
        smallest = left;
      }
      if (right < n && this.items[right].dist < this.items[smallest].dist) {
        smallest = right;
      }
      if (smallest === idx) break;
      [this.items[idx], this.items[smallest]] = [
        this.items[smallest],
        this.items[idx],
      ];
      idx = smallest;
    }
  }
}

/**
 * Shortest-path Dijkstra between two graph node IDs.
 * Returns null if no walking path exists.
 */
export function dijkstra(
  graph: RoutingGraph,
  startId: string,
  endId: string
): RouteResult | null {
  const startNode = graph.nodes.get(startId);
  const endNode = graph.nodes.get(endId);
  if (!startNode || !endNode) return null;

  if (startId === endId) {
    return {
      nodeIds: [startId],
      coords: [startNode.coord],
      segments: [],
      meters: 0,
      minutes: 0,
      usesManual: false,
    };
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, { from: string; manual: boolean }>();
  const visited = new Set<string>();
  const heap = new MinHeap();

  dist.set(startId, 0);
  heap.push({ id: startId, dist: 0 });

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.id === endId) break;

    const edges = graph.adjacency.get(current.id) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;
      const alt = current.dist + edge.meters;
      const existing = dist.get(edge.to);
      if (existing === undefined || alt < existing) {
        dist.set(edge.to, alt);
        prev.set(edge.to, { from: current.id, manual: edge.manual });
        heap.push({ id: edge.to, dist: alt });
      }
    }
  }

  const totalMeters = dist.get(endId);
  if (totalMeters === undefined) return null;

  // Reconstruct node sequence and edge manual flags
  const nodeIds: string[] = [];
  const edgeManuals: boolean[] = [];
  let cursor: string | undefined = endId;

  while (cursor !== undefined) {
    nodeIds.push(cursor);
    if (cursor === startId) break;
    const step = prev.get(cursor);
    if (!step) return null;
    edgeManuals.push(step.manual);
    cursor = step.from;
  }

  nodeIds.reverse();
  edgeManuals.reverse();

  const coords: LngLat[] = nodeIds.map((id) => graph.nodes.get(id)!.coord);
  const segments: RouteSegment[] = [];
  let usesManual = false;

  for (let i = 0; i < edgeManuals.length; i++) {
    const isManual = edgeManuals[i];
    if (isManual) usesManual = true;
    segments.push({
      coords: [coords[i], coords[i + 1]],
      manual: isManual,
    });
  }

  const minutes = Math.max(1, Math.ceil(totalMeters / graph.walkSpeedMPerMin));

  return {
    nodeIds,
    coords,
    segments,
    meters: totalMeters,
    minutes,
    usesManual,
  };
}

/**
 * Find the nearest junction node in the graph to a given [lng, lat].
 */
export function snapToGraph(lngLat: LngLat, graph: RoutingGraph): SnapResult {
  let bestId = '';
  let bestDist = Infinity;

  for (const node of graph.nodes.values()) {
    if (node.type !== 'junction') continue;
    const d = distanceMeters(lngLat, node.coord);
    if (d < bestDist) {
      bestDist = d;
      bestId = node.id;
    }
  }

  return { nodeId: bestId, distanceM: bestDist };
}

// Build graph and building entrance lookup ONCE at module load
const parsedBuildings = JSON.parse(buildingsRaw) as BuildingsGeoJSON;
const entranceNodeByBuildingId = new Map<string, string>(
  parsedBuildings.features.map((f) => [
    f.properties.id,
    f.properties.entranceNode,
  ])
);

export const campusRoutingGraph: RoutingGraph = buildGraph(
  pathsData as unknown as PathsGraph
);

/**
 * Route from a user coordinate to a building's entrance node.
 * Adds a short straight drawing leg from userLngLat to the snapped node if > 3 m away.
 */
export function routeFromUser(
  userLngLat: LngLat,
  buildingId: string
): RouteResult | null {
  const entranceNodeId = entranceNodeByBuildingId.get(buildingId);
  if (!entranceNodeId) return null;

  const snap = snapToGraph(userLngLat, campusRoutingGraph);
  if (!snap.nodeId) return null;

  const result = dijkstra(campusRoutingGraph, snap.nodeId, entranceNodeId);
  if (!result) return null;

  const entranceNode = campusRoutingGraph.nodes.get(entranceNodeId);
  const coords = [...result.coords];
  const segments = [...result.segments];

  if (snap.distanceM > 3 && coords.length > 0) {
    const firstCoord = coords[0];
    coords.unshift(userLngLat);
    segments.unshift({
      coords: [userLngLat, firstCoord],
      manual: false,
    });
  }

  return {
    ...result,
    coords,
    segments,
    snapDistanceM: snap.distanceM,
    destinationBuildingId: buildingId,
    destinationEntrance: entranceNode?.coord,
  };
}

/**
 * Route between two building entrance nodes (used for unit tests).
 */
export function routeBetween(
  buildingIdA: string,
  buildingIdB: string
): RouteResult | null {
  const entA = entranceNodeByBuildingId.get(buildingIdA);
  const entB = entranceNodeByBuildingId.get(buildingIdB);
  if (!entA || !entB) return null;
  return dijkstra(campusRoutingGraph, entA, entB);
}

/**
 * Convert a RouteResult into a GeoJSON FeatureCollection for MapLibre rendering.
 * Each feature carries { manual: boolean } so regular and guessed segments style differently.
 */
export function routeToGeoJSON(
  route: RouteResult | null
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  if (!route || route.segments.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  // Merge consecutive segments with the same `manual` flag into clean LineStrings
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  let currentCoords: LngLat[] = [...route.segments[0].coords];
  let currentManual = route.segments[0].manual;

  for (let i = 1; i < route.segments.length; i++) {
    const seg = route.segments[i];
    if (seg.manual === currentManual) {
      currentCoords.push(seg.coords[1]);
    } else {
      features.push({
        type: 'Feature',
        properties: { manual: currentManual },
        geometry: { type: 'LineString', coordinates: currentCoords },
      });
      currentCoords = [...seg.coords];
      currentManual = seg.manual;
    }
  }

  features.push({
    type: 'Feature',
    properties: { manual: currentManual },
    geometry: { type: 'LineString', coordinates: currentCoords },
  });

  return { type: 'FeatureCollection', features };
}

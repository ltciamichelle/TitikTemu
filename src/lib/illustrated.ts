import type { Building, LngLat, PathsGraph } from '../types';
import { FLOOR_HEIGHT_M } from './constants';
import { computePolygonCentroid, getEstimatedBuildingHeightM } from './geo';

export interface BuildingStyleEntry {
  name?: string;
  wall: string;
  wallAlt: string;
  roof: string;
  accent: string;
  windowTint: string;
  source: string;
}

export type BuildingStyleMap = Record<string, BuildingStyleEntry>;

export interface IllustratedAssets {
  version: string;
  paving: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  shadows3D: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  shadows2D: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  buildingBands: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  buildingRoofs: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  contextExtrusions: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  contextRoofs: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  treeGrass: GeoJSON.FeatureCollection<GeoJSON.Point>;
  treeTrunks: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  treeCanopies: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  treeCount: number;
}

const ILLUSTRATED_CACHE_VERSION = 'v1-untar-illustrated';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_R = 6371000;

const CONTEXT_PALETTE = [
  '#E4E9E5',
  '#E9E5DC',
  '#DFE6EC',
  '#ECE3DF',
  '#E3E8EC',
];

const CANOPY_PALETTE = ['#9ED9B4', '#86CFA3', '#B4E3C2'];
const TRUNK_COLOR = '#8A6F5A';
const CONTEXT_ROOF_COLOR = '#D2D7DC';

const DEFAULT_STYLE: BuildingStyleEntry = {
  wall: '#E3EBDD',
  wallAlt: '#D1D8CB',
  roof: '#C9CED6',
  accent: '#FF8A3D',
  windowTint: '#A9C7D8',
  source: 'default',
};

/** Deterministic seeded PRNG (Mulberry32). */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashIndex(idx: number): number {
  let x = (idx + 1) * 2654435761;
  x = ((x ^ (x >>> 16)) * 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function toLocalMeters(
  pt: LngLat,
  refLng: number,
  refLat: number,
  cosLat: number
): [number, number] {
  return [
    (pt[0] - refLng) * DEG_TO_RAD * cosLat * EARTH_R,
    (pt[1] - refLat) * DEG_TO_RAD * EARTH_R,
  ];
}

function fromLocalMeters(
  xy: [number, number],
  refLng: number,
  refLat: number,
  cosLat: number
): LngLat {
  return [
    refLng + (xy[0] / (EARTH_R * cosLat)) * RAD_TO_DEG,
    refLat + (xy[1] / EARTH_R) * RAD_TO_DEG,
  ];
}

/** 2D convex hull (Andrew's monotone chain) on [x, y] points. */
function convexHull2D(points: [number, number][]): [number, number][] {
  if (points.length <= 3) return points;
  const pts = [...points].sort((a, b) =>
    a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]
  );

  const cross = (
    o: [number, number],
    a: [number, number],
    b: [number, number]
  ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: [number, number][] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/**
 * Build a swept shadow polygon (convex hull of footprint + SE-shifted footprint).
 * Light comes from north-west -> shadow shifts south-east (+dx, -dy).
 */
function buildShadowPolygon(
  ring: LngLat[],
  shiftMeters: number,
  refLng: number,
  refLat: number,
  cosLat: number
): LngLat[] {
  if (ring.length < 3 || shiftMeters <= 0.1) return ring;
  const dx = Math.SQRT1_2 * shiftMeters;
  const dy = -Math.SQRT1_2 * shiftMeters;

  const localPts: [number, number][] = [];
  for (const pt of ring) {
    const [x, y] = toLocalMeters(pt, refLng, refLat, cosLat);
    localPts.push([x, y]);
    localPts.push([x + dx, y + dy]);
  }

  const hull = convexHull2D(localPts);
  const out = hull.map((p) => fromLocalMeters(p, refLng, refLat, cosLat));
  if (out.length > 0) out.push(out[0]);
  return out;
}

/**
 * Scale a polygon ring inward toward its centroid by `insetMeters` (clamped safely).
 */
function insetRingTowardCentroid(
  ring: LngLat[],
  centroid: LngLat,
  insetMeters: number,
  refLng: number,
  refLat: number,
  cosLat: number
): LngLat[] {
  const [cx, cy] = toLocalMeters(centroid, refLng, refLat, cosLat);
  const out: LngLat[] = ring.map((pt) => {
    const [x, y] = toLocalMeters(pt, refLng, refLat, cosLat);
    const vx = x - cx;
    const vy = y - cy;
    const dist = Math.hypot(vx, vy);
    if (dist <= 0.5) return pt;
    const scale = Math.max(0.45, (dist - insetMeters) / dist);
    return fromLocalMeters(
      [cx + vx * scale, cy + vy * scale],
      refLng,
      refLat,
      cosLat
    );
  });
  return out;
}

/** Create a small regular polygon (octagon for trees, square for rooftop box). */
function makeRegularPolygon(
  center: [number, number],
  radiusM: number,
  sides: number,
  rotationRad: number,
  refLng: number,
  refLat: number,
  cosLat: number
): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotationRad + (i * 2 * Math.PI) / sides;
    const x = center[0] + Math.cos(angle) * radiusM;
    const y = center[1] + Math.sin(angle) * radiusM;
    ring.push(fromLocalMeters([x, y], refLng, refLat, cosLat));
  }
  ring.push(ring[0]);
  return ring;
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + dx * t;
  const projY = ay + dy * t;
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

function pointInPolygon2D(
  px: number,
  py: number,
  poly: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

interface LocalPoly {
  ring: [number, number][];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function makeLocalPoly(
  ring: LngLat[],
  refLng: number,
  refLat: number,
  cosLat: number
): LocalPoly {
  const pts: [number, number][] = ring.map((pt) =>
    toLocalMeters(pt, refLng, refLat, cosLat)
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { ring: pts, minX, maxX, minY, maxY };
}

function isNearPolygon(
  px: number,
  py: number,
  poly: LocalPoly,
  clearanceM: number
): boolean {
  if (
    px < poly.minX - clearanceM ||
    px > poly.maxX + clearanceM ||
    py < poly.minY - clearanceM ||
    py > poly.maxY + clearanceM
  ) {
    return false;
  }
  if (pointInPolygon2D(px, py, poly.ring)) return true;
  const clearSq = clearanceM * clearanceM;
  for (let i = 1; i < poly.ring.length; i++) {
    const a = poly.ring[i - 1];
    const b = poly.ring[i];
    if (pointToSegmentDistSq(px, py, a[0], a[1], b[0], b[1]) <= clearSq) {
      return true;
    }
  }
  return false;
}

let cachedAssets: IllustratedAssets | null = null;

/**
 * Precompute all decorative illustrated GeoJSON layers ONCE at startup.
 * Cached in memory with a version key so state/camera changes never recompute it.
 */
export function getIllustratedAssets(params: {
  buildings: Building[];
  buildingStyles: BuildingStyleMap;
  context3DGeoJSON: GeoJSON.FeatureCollection | null;
  paths: PathsGraph;
}): IllustratedAssets {
  if (cachedAssets && cachedAssets.version === ILLUSTRATED_CACHE_VERSION) {
    return cachedAssets;
  }

  const { buildings, buildingStyles, context3DGeoJSON, paths } = params;

  // Compute campus bbox center as local projection origin
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

  const refLng = (minLng + maxLng) / 2;
  const refLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos(refLat * DEG_TO_RAD);

  const [bMinX, bMinY] = toLocalMeters(
    [minLng, minLat],
    refLng,
    refLat,
    cosLat
  );
  const [bMaxX, bMaxY] = toLocalMeters(
    [maxLng, maxLat],
    refLng,
    refLat,
    cosLat
  );

  // 1. Campus paving tint polygon (6 buildings + 40 m)
  const PAVING_MARGIN = 40;
  const pavingRing: LngLat[] = [
    fromLocalMeters(
      [bMinX - PAVING_MARGIN, bMinY - PAVING_MARGIN],
      refLng,
      refLat,
      cosLat
    ),
    fromLocalMeters(
      [bMaxX + PAVING_MARGIN, bMinY - PAVING_MARGIN],
      refLng,
      refLat,
      cosLat
    ),
    fromLocalMeters(
      [bMaxX + PAVING_MARGIN, bMaxY + PAVING_MARGIN],
      refLng,
      refLat,
      cosLat
    ),
    fromLocalMeters(
      [bMinX - PAVING_MARGIN, bMaxY + PAVING_MARGIN],
      refLng,
      refLat,
      cosLat
    ),
    fromLocalMeters(
      [bMinX - PAVING_MARGIN, bMinY - PAVING_MARGIN],
      refLng,
      refLat,
      cosLat
    ),
  ];

  const paving: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { decorative: true },
        geometry: { type: 'Polygon', coordinates: [pavingRing] },
      },
    ],
  };

  // 2. Shadows + 3. UNTAR Building Floor Bands + 4. Roof Caps
  const shadow3DFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const shadow2DFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const bandFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const roofFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const obstaclePolys: LocalPoly[] = [];

  for (const b of buildings) {
    const outerRing = b.polygon[0];
    if (!outerRing || outerRing.length < 3) continue;

    obstaclePolys.push(makeLocalPoly(outerRing, refLng, refLat, cosLat));

    const style = buildingStyles[b.id] ?? DEFAULT_STYLE;
    const heightM = getEstimatedBuildingHeightM(b);
    const floors = Math.max(1, Math.round(heightM / FLOOR_HEIGHT_M));

    // Soft shadows (3D: heightM * 0.45, 2D: heightM * 0.2)
    shadow3DFeatures.push({
      type: 'Feature',
      properties: { id: b.id, kind: 'untar', decorative: true },
      geometry: {
        type: 'Polygon',
        coordinates: [
          buildShadowPolygon(
            outerRing,
            heightM * 0.45,
            refLng,
            refLat,
            cosLat
          ),
        ],
      },
    });

    shadow2DFeatures.push({
      type: 'Feature',
      properties: { id: b.id, kind: 'untar', decorative: true },
      geometry: {
        type: 'Polygon',
        coordinates: [
          buildShadowPolygon(outerRing, heightM * 0.2, refLng, refLat, cosLat),
        ],
      },
    });

    // Floor bands: alternating wall / wallAlt with non-overlapping 40% middle glass band
    for (let f = 1; f <= floors; f++) {
      const base = (f - 1) * FLOOR_HEIGHT_M;
      const top = f * FLOOR_HEIGHT_M;
      const wallColor = f % 2 === 1 ? style.wall : style.wallAlt;
      const glassBase = base + FLOOR_HEIGHT_M * 0.3;
      const glassTop = base + FLOOR_HEIGHT_M * 0.7;

      bandFeatures.push(
        {
          type: 'Feature',
          properties: {
            id: b.id,
            floor: f,
            base,
            height: glassBase,
            color: wallColor,
            decorative: true,
          },
          geometry: { type: 'Polygon', coordinates: b.polygon },
        },
        {
          type: 'Feature',
          properties: {
            id: b.id,
            floor: f,
            base: glassBase,
            height: glassTop,
            color: style.windowTint,
            decorative: true,
          },
          geometry: { type: 'Polygon', coordinates: b.polygon },
        },
        {
          type: 'Feature',
          properties: {
            id: b.id,
            floor: f,
            base: glassTop,
            height: top,
            color: wallColor,
            decorative: true,
          },
          geometry: { type: 'Polygon', coordinates: b.polygon },
        }
      );
    }

    // Roof cap (inset 1.5 m, 1.2 m tall)
    const roofRing = insetRingTowardCentroid(
      outerRing,
      b.centroid,
      1.5,
      refLng,
      refLat,
      cosLat
    );
    roofFeatures.push({
      type: 'Feature',
      properties: {
        id: b.id,
        base: heightM,
        height: heightM + 1.2,
        color: style.roof,
        decorative: true,
      },
      geometry: { type: 'Polygon', coordinates: [roofRing] },
    });

    // Optional decorative rooftop mechanical box (3 m x 3 m, 2 m tall) on tall buildings
    if (floors >= 8) {
      const cLocal = toLocalMeters(b.centroid, refLng, refLat, cosLat);
      const boxRing = makeRegularPolygon(
        cLocal,
        2.12, // ~3m x 3m square (diagonal half = 1.5 * sqrt(2) = 2.12 m)
        4,
        Math.PI / 4,
        refLng,
        refLat,
        cosLat
      );
      roofFeatures.push({
        type: 'Feature',
        properties: {
          id: b.id,
          base: heightM + 1.2,
          height: heightM + 3.2,
          color: style.wallAlt,
          decorative: true,
        },
        geometry: { type: 'Polygon', coordinates: [boxRing] },
      });
    }
  }

  // 5. Context buildings (decorative seeded heights 5..12 m, 5-color pastel palette, 0.6 m roofs, smaller shadows)
  const contextExtrusionFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const contextRoofFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

  if (context3DGeoJSON) {
    context3DGeoJSON.features.forEach((f, idx) => {
      const geom = f.geometry;
      let outerRing: LngLat[] | undefined;
      if (geom.type === 'Polygon') {
        outerRing = geom.coordinates[0] as LngLat[];
      } else if (geom.type === 'MultiPolygon') {
        outerRing = geom.coordinates[0]?.[0] as LngLat[];
      }
      if (!outerRing || outerRing.length < 3) return;

      obstaclePolys.push(makeLocalPoly(outerRing, refLng, refLat, cosLat));

      const h = hashIndex(idx);
      const ctxHeight = 5 + (h % 8); // 5..12 m deterministic
      const ctxColor = CONTEXT_PALETTE[h % CONTEXT_PALETTE.length];
      const centroid = computePolygonCentroid(outerRing);

      contextExtrusionFeatures.push({
        type: 'Feature',
        properties: {
          height: ctxHeight,
          color: ctxColor,
          decorative: true,
        },
        geometry: { type: 'Polygon', coordinates: [outerRing] },
      });

      const roofRing = insetRingTowardCentroid(
        outerRing,
        centroid,
        0.8,
        refLng,
        refLat,
        cosLat
      );
      contextRoofFeatures.push({
        type: 'Feature',
        properties: {
          base: ctxHeight,
          height: ctxHeight + 0.6,
          color: CONTEXT_ROOF_COLOR,
          decorative: true,
        },
        geometry: { type: 'Polygon', coordinates: [roofRing] },
      });

      shadow3DFeatures.push({
        type: 'Feature',
        properties: { kind: 'context', decorative: true },
        geometry: {
          type: 'Polygon',
          coordinates: [
            buildShadowPolygon(
              outerRing,
              ctxHeight * 0.3,
              refLng,
              refLat,
              cosLat
            ),
          ],
        },
      });

      shadow2DFeatures.push({
        type: 'Feature',
        properties: { kind: 'context', decorative: true },
        geometry: {
          type: 'Polygon',
          coordinates: [
            buildShadowPolygon(
              outerRing,
              ctxHeight * 0.14,
              refLng,
              refLat,
              cosLat
            ),
          ],
        },
      });
    });
  }

  // 6. Decorative Trees via seeded Poisson-disc sampling (min dist 7 m, max 220 trees)
  const nodeMap = new Map(paths.nodes.map((n) => [n.id, n]));
  const pathSegments: [number, number, number, number][] = [];
  for (const edge of paths.edges) {
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (!a || !b) continue;
    const [ax, ay] = toLocalMeters(a.coord, refLng, refLat, cosLat);
    const [bx, by] = toLocalMeters(b.coord, refLng, refLat, cosLat);
    pathSegments.push([ax, ay, bx, by]);
  }

  const TREE_MARGIN = 120;
  const MIN_TREE_DIST = 7;
  const MAX_TREES = 220;
  const BUILDING_CLEARANCE = 4;
  const ROAD_CLEARANCE = 5;

  const tMinX = bMinX - TREE_MARGIN;
  const tMaxX = bMaxX + TREE_MARGIN;
  const tMinY = bMinY - TREE_MARGIN;
  const tMaxY = bMaxY + TREE_MARGIN;
  const width = tMaxX - tMinX;
  const height = tMaxY - tMinY;

  const cellSize = MIN_TREE_DIST / Math.SQRT2;
  const gridCols = Math.ceil(width / cellSize);
  const gridRows = Math.ceil(height / cellSize);
  const grid = new Int32Array(gridCols * gridRows).fill(-1);

  const rng = createRng(20261125);
  const samples: [number, number][] = [];
  const active: number[] = [];

  const isValidTreePoint = (x: number, y: number): boolean => {
    if (x < tMinX || x > tMaxX || y < tMinY || y > tMaxY) return false;

    // Spatial hash check for min 7 m spacing
    const gx = Math.floor((x - tMinX) / cellSize);
    const gy = Math.floor((y - tMinY) / cellSize);
    const minDistSq = MIN_TREE_DIST * MIN_TREE_DIST;

    for (
      let ny = Math.max(0, gy - 2);
      ny <= Math.min(gridRows - 1, gy + 2);
      ny++
    ) {
      for (
        let nx = Math.max(0, gx - 2);
        nx <= Math.min(gridCols - 1, gx + 2);
        nx++
      ) {
        const idx = grid[ny * gridCols + nx];
        if (idx !== -1) {
          const s = samples[idx];
          const dSq = (x - s[0]) * (x - s[0]) + (y - s[1]) * (y - s[1]);
          if (dSq < minDistSq) return false;
        }
      }
    }

    // Exclude within 5 m of any walking graph / road edge (also guarantees >= 4 m from routes)
    const roadClearSq = ROAD_CLEARANCE * ROAD_CLEARANCE;
    for (const [ax, ay, bx, by] of pathSegments) {
      if (pointToSegmentDistSq(x, y, ax, ay, bx, by) <= roadClearSq) {
        return false;
      }
    }

    // Exclude inside or within 4 m of any building footprint (UNTAR + context)
    for (const poly of obstaclePolys) {
      if (isNearPolygon(x, y, poly, BUILDING_CLEARANCE)) {
        return false;
      }
    }

    return true;
  };

  const addTreeSample = (x: number, y: number) => {
    const idx = samples.length;
    samples.push([x, y]);
    active.push(idx);
    const gx = Math.floor((x - tMinX) / cellSize);
    const gy = Math.floor((y - tMinY) / cellSize);
    if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
      grid[gy * gridCols + gx] = idx;
    }
  };

  // Seed a few starting candidates across the area so Poisson-disc covers pockets around buildings
  for (let attempt = 0; attempt < 180 && samples.length < 18; attempt++) {
    const x = tMinX + rng() * width;
    const y = tMinY + rng() * height;
    if (isValidTreePoint(x, y)) {
      addTreeSample(x, y);
    }
  }

  while (active.length > 0 && samples.length < MAX_TREES) {
    const pick = Math.floor(rng() * active.length);
    const basePt = samples[active[pick]];
    let placed = false;

    for (let k = 0; k < 20; k++) {
      const angle = rng() * Math.PI * 2;
      const dist = MIN_TREE_DIST * (1 + rng());
      const nx = basePt[0] + Math.cos(angle) * dist;
      const ny = basePt[1] + Math.sin(angle) * dist;
      if (isValidTreePoint(nx, ny)) {
        addTreeSample(nx, ny);
        placed = true;
        if (samples.length >= MAX_TREES) break;
      }
    }

    if (!placed) {
      active.splice(pick, 1);
    }
  }

  const grassFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const trunkFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const canopyFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    const lngLat = fromLocalMeters(pt, refLng, refLat, cosLat);
    const canopyRadius = 2.2 + rng() * 1.0; // 2.2 .. 3.2 m
    const canopyHeight = 5.5 + rng() * 2.0; // 5.5 .. 7.5 m
    const canopyColor = CANOPY_PALETTE[i % CANOPY_PALETTE.length];
    const rot = rng() * Math.PI;

    grassFeatures.push({
      type: 'Feature',
      properties: { decorative: true },
      geometry: { type: 'Point', coordinates: lngLat },
    });

    trunkFeatures.push({
      type: 'Feature',
      properties: {
        base: 0,
        height: 2.2,
        color: TRUNK_COLOR,
        decorative: true,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          makeRegularPolygon(pt, 0.4, 8, rot, refLng, refLat, cosLat),
        ],
      },
    });

    canopyFeatures.push({
      type: 'Feature',
      properties: {
        base: 2.2,
        height: canopyHeight,
        color: canopyColor,
        decorative: true,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          makeRegularPolygon(pt, canopyRadius, 8, rot, refLng, refLat, cosLat),
        ],
      },
    });
  }

  cachedAssets = {
    version: ILLUSTRATED_CACHE_VERSION,
    paving,
    shadows3D: { type: 'FeatureCollection', features: shadow3DFeatures },
    shadows2D: { type: 'FeatureCollection', features: shadow2DFeatures },
    buildingBands: { type: 'FeatureCollection', features: bandFeatures },
    buildingRoofs: { type: 'FeatureCollection', features: roofFeatures },
    contextExtrusions: {
      type: 'FeatureCollection',
      features: contextExtrusionFeatures,
    },
    contextRoofs: { type: 'FeatureCollection', features: contextRoofFeatures },
    treeGrass: { type: 'FeatureCollection', features: grassFeatures },
    treeTrunks: { type: 'FeatureCollection', features: trunkFeatures },
    treeCanopies: { type: 'FeatureCollection', features: canopyFeatures },
    treeCount: samples.length,
  };

  return cachedAssets;
}

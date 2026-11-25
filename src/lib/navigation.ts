import pathsData from '../data/paths.json';
import type { LngLat } from '../types';
import { OFF_ROUTE_THRESHOLD_M } from './cameraConfig';
import { distanceMeters, type RouteResult } from './routing';

export type ManeuverType =
  | 'straight'
  | 'left'
  | 'right'
  | 'sharp-left'
  | 'sharp-right'
  | 'arrive';

export interface PreparedRoute {
  coords: LngLat[];
  cumDistM: number[];
  totalMeters: number;
}

export interface RouteSnapResult {
  distanceAlongM: number;
  offsetM: number;
  snappedCoord: LngLat;
}

export interface Maneuver {
  type: ManeuverType;
  distanceToM: number;
  coord: LngLat;
  headingAfter: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_M = 6371000;
const DEFAULT_WALK_SPEED_M_PER_MIN =
  (pathsData as { walkSpeedMPerMin?: number }).walkSpeedMPerMin || 80;

/**
 * Normalize an angle in degrees to [0, 360).
 */
export function normalizeBearing(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/**
 * Shortest signed angular delta from `fromDeg` to `toDeg` in (-180, 180].
 * Positive = clockwise (right turn), Negative = counter-clockwise (left turn).
 * Handles 359 -> 0 wrap cleanly (+1 deg).
 */
export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  let delta = normalizeBearing(toDeg) - normalizeBearing(fromDeg);
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

/**
 * Exponential bearing smoothing along the shortest angular arc.
 */
export function smoothBearing(
  currentDeg: number,
  targetDeg: number,
  alpha: number
): number {
  const delta = shortestAngleDelta(currentDeg, targetDeg);
  return normalizeBearing(currentDeg + delta * alpha);
}

/**
 * Compass bearing in degrees [0, 360) from point `a` to point `b`
 * using a local equirectangular approximation.
 * 0 = North, 90 = East, 180 = South, 270 = West.
 */
export function bearingBetween(a: LngLat, b: LngLat): number {
  const avgLatRad = ((a[1] + b[1]) / 2) * DEG_TO_RAD;
  const dx =
    (b[0] - a[0]) * DEG_TO_RAD * Math.cos(avgLatRad) * EARTH_RADIUS_M;
  const dy = (b[1] - a[1]) * DEG_TO_RAD * EARTH_RADIUS_M;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 0;
  return normalizeBearing(Math.atan2(dx, dy) * RAD_TO_DEG);
}

/**
 * Offset a coordinate by (dxMeters east, dyMeters north) using local equirectangular approximation.
 */
export function offsetCoordMeters(
  origin: LngLat,
  dxMeters: number,
  dyMeters: number
): LngLat {
  const latRad = origin[1] * DEG_TO_RAD;
  const dLat = (dyMeters / EARTH_RADIUS_M) * RAD_TO_DEG;
  const dLng = (dxMeters / (EARTH_RADIUS_M * Math.cos(latRad))) * RAD_TO_DEG;
  return [origin[0] + dLng, origin[1] + dLat];
}

/**
 * Precompute cumulative distance in meters for every vertex of a route polyline.
 */
export function prepareRoute(coords: LngLat[]): PreparedRoute {
  if (coords.length === 0) {
    return { coords: [], cumDistM: [], totalMeters: 0 };
  }

  const cumDistM: number[] = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += distanceMeters(coords[i - 1], coords[i]);
    cumDistM.push(total);
  }

  return {
    coords: [...coords],
    cumDistM,
    totalMeters: total,
  };
}

/**
 * Interpolate a coordinate at `distanceAlongM` meters along a prepared route.
 */
export function pointAt(
  prepared: PreparedRoute,
  distanceAlongM: number
): LngLat {
  const { coords, cumDistM, totalMeters } = prepared;
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1 || distanceAlongM <= 0) return coords[0];
  if (distanceAlongM >= totalMeters) return coords[coords.length - 1];

  for (let i = 1; i < coords.length; i++) {
    if (cumDistM[i] >= distanceAlongM) {
      const segStart = cumDistM[i - 1];
      const segLen = cumDistM[i] - segStart;
      const t = segLen > 1e-9 ? (distanceAlongM - segStart) / segLen : 0;
      const a = coords[i - 1];
      const b = coords[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }

  return coords[coords.length - 1];
}

/**
 * Bearing in degrees toward the point `lookaheadM` meters ahead of `distanceAlongM`.
 */
export function headingAhead(
  prepared: PreparedRoute,
  distanceAlongM: number,
  lookaheadM = 25
): number {
  if (prepared.coords.length < 2) return 0;
  const clampedDist = Math.max(0, Math.min(distanceAlongM, prepared.totalMeters));
  const targetDist = Math.min(prepared.totalMeters, clampedDist + lookaheadM);

  // Near the very end, look back slightly so heading stays stable
  if (targetDist - clampedDist < 0.5) {
    const backDist = Math.max(0, prepared.totalMeters - 2);
    return bearingBetween(
      pointAt(prepared, backDist),
      prepared.coords[prepared.coords.length - 1]
    );
  }

  return bearingBetween(
    pointAt(prepared, clampedDist),
    pointAt(prepared, targetDist)
  );
}

/**
 * Project an arbitrary coordinate onto the nearest point of the route polyline.
 * Returns { distanceAlongM, offsetM, snappedCoord }.
 */
export function snapToRoute(
  prepared: PreparedRoute,
  lngLat: LngLat
): RouteSnapResult {
  const { coords, cumDistM } = prepared;
  if (coords.length === 0) {
    return { distanceAlongM: 0, offsetM: Infinity, snappedCoord: lngLat };
  }
  if (coords.length === 1) {
    return {
      distanceAlongM: 0,
      offsetM: distanceMeters(lngLat, coords[0]),
      snappedCoord: coords[0],
    };
  }

  let bestOffset = Infinity;
  let bestDistAlong = 0;
  let bestCoord: LngLat = coords[0];

  const refLatRad = lngLat[1] * DEG_TO_RAD;
  const cosLat = Math.cos(refLatRad);

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];

    // Local equirectangular coords relative to `a`
    const ax = 0;
    const ay = 0;
    const bx = (b[0] - a[0]) * DEG_TO_RAD * cosLat * EARTH_RADIUS_M;
    const by = (b[1] - a[1]) * DEG_TO_RAD * EARTH_RADIUS_M;
    const px = (lngLat[0] - a[0]) * DEG_TO_RAD * cosLat * EARTH_RADIUS_M;
    const py = (lngLat[1] - a[1]) * DEG_TO_RAD * EARTH_RADIUS_M;

    const segLenSq = bx * bx + by * by;
    let t = 0;
    if (segLenSq > 1e-9) {
      t = Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / segLenSq));
    }

    const projX = bx * t;
    const projY = by * t;
    const offset = Math.hypot(px - projX, py - projY);

    if (offset < bestOffset) {
      bestOffset = offset;
      const segMeters = cumDistM[i] - cumDistM[i - 1];
      bestDistAlong = cumDistM[i - 1] + segMeters * t;
      bestCoord = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }

  return {
    distanceAlongM: bestDistAlong,
    offsetM: bestOffset,
    snappedCoord: bestCoord,
  };
}

/**
 * Find the next maneuver along the route where the heading changes by >= 35 degrees
 * (comparing average heading of 8 m before vs 8 m after each candidate vertex).
 * If no turn >= 35 degrees remains, returns "arrive" with distance to the end.
 */
export function nextManeuver(
  prepared: PreparedRoute,
  distanceAlongM: number
): Maneuver {
  const { coords, cumDistM, totalMeters } = prepared;
  if (coords.length === 0) {
    return { type: 'arrive', distanceToM: 0, coord: [0, 0], headingAfter: 0 };
  }

  const clampedDist = Math.max(0, Math.min(distanceAlongM, totalMeters));
  const endCoord = coords[coords.length - 1];

  if (coords.length < 3 || totalMeters - clampedDist <= 1) {
    return {
      type: 'arrive',
      distanceToM: Math.max(0, totalMeters - clampedDist),
      coord: endCoord,
      headingAfter: headingAhead(prepared, Math.max(0, totalMeters - 2), 2),
    };
  }

  const WINDOW_M = 8;
  const TURN_THRESHOLD_DEG = 35;

  for (let i = 1; i < coords.length - 1; i++) {
    const vertexDist = cumDistM[i];
    // Skip corners we already passed (allow small 2 m buffer)
    if (vertexDist <= clampedDist + 2) continue;

    const beforeStart = Math.max(0, vertexDist - WINDOW_M);
    const afterEnd = Math.min(totalMeters, vertexDist + WINDOW_M);

    if (vertexDist - beforeStart < 0.5 || afterEnd - vertexDist < 0.5) {
      continue;
    }

    const headingBefore = bearingBetween(
      pointAt(prepared, beforeStart),
      coords[i]
    );
    const headingAfter = bearingBetween(coords[i], pointAt(prepared, afterEnd));
    const delta = shortestAngleDelta(headingBefore, headingAfter);
    const absDelta = Math.abs(delta);

    if (absDelta >= TURN_THRESHOLD_DEG) {
      let type: ManeuverType;
      if (delta < 0) {
        type = absDelta >= 110 ? 'sharp-left' : 'left';
      } else {
        type = absDelta >= 110 ? 'sharp-right' : 'right';
      }

      return {
        type,
        distanceToM: Math.max(0, vertexDist - clampedDist),
        coord: coords[i],
        headingAfter,
      };
    }
  }

  // No turn >= 35 deg ahead -> arrive at end
  return {
    type: 'arrive',
    distanceToM: Math.max(0, totalMeters - clampedDist),
    coord: endCoord,
    headingAfter: headingAhead(prepared, clampedDist, 20),
  };
}

export function remainingM(
  prepared: PreparedRoute,
  distanceAlongM: number
): number {
  return Math.max(0, prepared.totalMeters - Math.max(0, distanceAlongM));
}

export function etaMinutes(
  remainingMeters: number,
  walkSpeedMPerMin = DEFAULT_WALK_SPEED_M_PER_MIN
): number {
  if (remainingMeters <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMeters / walkSpeedMPerMin));
}

export function isOffRoute(offsetM: number): boolean {
  return offsetM > OFF_ROUTE_THRESHOLD_M;
}

/**
 * Split a RouteResult at `distanceAlongM` into two GeoJSON FeatureCollections:
 * - `done`: walked portion (solid light mint #BFE8D8)
 * - `remaining`: ahead portion (preserving `manual` property on each segment)
 */
export function splitRouteGeoJSON(
  route: RouteResult | null,
  distanceAlongM: number
): {
  done: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  remaining: GeoJSON.FeatureCollection<GeoJSON.LineString>;
} {
  if (!route || route.segments.length === 0) {
    return {
      done: { type: 'FeatureCollection', features: [] },
      remaining: { type: 'FeatureCollection', features: [] },
    };
  }

  const doneCoords: LngLat[] = [];
  const remainingFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  let cursorDist = 0;
  let remCurrentCoords: LngLat[] = [];
  let remCurrentManual: boolean | null = null;

  const flushRemaining = () => {
    if (remCurrentCoords.length >= 2 && remCurrentManual !== null) {
      remainingFeatures.push({
        type: 'Feature',
        properties: { manual: remCurrentManual },
        geometry: { type: 'LineString', coordinates: remCurrentCoords },
      });
    }
    remCurrentCoords = [];
    remCurrentManual = null;
  };

  const pushRemainingSeg = (a: LngLat, b: LngLat, manual: boolean) => {
    if (remCurrentManual === manual && remCurrentCoords.length > 0) {
      remCurrentCoords.push(b);
    } else {
      flushRemaining();
      remCurrentCoords = [a, b];
      remCurrentManual = manual;
    }
  };

  for (const seg of route.segments) {
    const [a, b] = seg.coords;
    const segLen = distanceMeters(a, b);
    const segEnd = cursorDist + segLen;

    if (segEnd <= distanceAlongM) {
      // Entire segment already walked
      if (doneCoords.length === 0) doneCoords.push(a);
      doneCoords.push(b);
    } else if (cursorDist >= distanceAlongM) {
      // Entire segment still ahead
      pushRemainingSeg(a, b, seg.manual);
    } else {
      // Split point lies inside this segment
      const t = segLen > 1e-9 ? (distanceAlongM - cursorDist) / segLen : 0;
      const splitPt: LngLat = [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
      ];
      if (doneCoords.length === 0) doneCoords.push(a);
      doneCoords.push(splitPt);
      pushRemainingSeg(splitPt, b, seg.manual);
    }

    cursorDist = segEnd;
  }

  flushRemaining();

  const doneFeatures: GeoJSON.Feature<GeoJSON.LineString>[] =
    doneCoords.length >= 2
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: doneCoords },
          },
        ]
      : [];

  return {
    done: { type: 'FeatureCollection', features: doneFeatures },
    remaining: { type: 'FeatureCollection', features: remainingFeatures },
  };
}

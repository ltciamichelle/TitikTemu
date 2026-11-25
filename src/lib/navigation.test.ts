import { describe, expect, it } from 'vitest';
import type { LngLat } from '../types';
import {
  etaMinutes,
  headingAhead,
  isOffRoute,
  nextManeuver,
  offsetCoordMeters,
  pointAt,
  prepareRoute,
  remainingM,
  shortestAngleDelta,
  smoothBearing,
  snapToRoute,
} from './navigation';

const ORIGIN: LngLat = [106.7897, -6.169];

describe('Navigation 3D pure helpers (src/lib/navigation.ts)', () => {
  it('straight line gives "arrive" with remaining distance equal to route length', () => {
    // 100 m due north
    const p0 = ORIGIN;
    const p1 = offsetCoordMeters(ORIGIN, 0, 50);
    const p2 = offsetCoordMeters(ORIGIN, 0, 100);
    const prepared = prepareRoute([p0, p1, p2]);

    expect(Math.abs(prepared.totalMeters - 100)).toBeLessThan(0.5);
    expect(remainingM(prepared, 0)).toBeCloseTo(prepared.totalMeters, 5);

    const m = nextManeuver(prepared, 0);
    expect(m.type).toBe('arrive');
    expect(Math.abs(m.distanceToM - 100)).toBeLessThan(0.5);
  });

  it('L-shaped route gives "right" or "left" at the corner with the right distance', () => {
    // 40 m North, then 40 m East -> right turn at 40 m
    const p0 = ORIGIN;
    const corner = offsetCoordMeters(ORIGIN, 0, 40);
    const endRight = offsetCoordMeters(corner, 40, 0);
    const rightRoute = prepareRoute([p0, corner, endRight]);

    const mRight = nextManeuver(rightRoute, 5);
    expect(mRight.type).toBe('right');
    expect(Math.abs(mRight.distanceToM - 35)).toBeLessThan(0.5);
    expect(Math.abs(mRight.headingAfter - 90)).toBeLessThan(1);

    // 40 m North, then 40 m West -> left turn at 40 m
    const endLeft = offsetCoordMeters(corner, -40, 0);
    const leftRoute = prepareRoute([p0, corner, endLeft]);

    const mLeft = nextManeuver(leftRoute, 10);
    expect(mLeft.type).toBe('left');
    expect(Math.abs(mLeft.distanceToM - 30)).toBeLessThan(0.5);
    expect(Math.abs(mLeft.headingAfter - 270)).toBeLessThan(1);
  });

  it('handles bearing wrap-around across 359 -> 0 cleanly', () => {
    expect(shortestAngleDelta(359, 0)).toBeCloseTo(1, 5);
    expect(shortestAngleDelta(0, 359)).toBeCloseTo(-1, 5);
    expect(shortestAngleDelta(355, 5)).toBeCloseTo(10, 5);
    expect(shortestAngleDelta(5, 355)).toBeCloseTo(-10, 5);

    // Smoothing from 358 toward 2 with alpha 0.5 should land at 0 (not 180!)
    const smoothed = smoothBearing(358, 2, 0.5);
    expect(smoothed).toBeCloseTo(0, 5);

    const smoothedStep = smoothBearing(359, 1, 0.25);
    expect(smoothedStep).toBeCloseTo(359.5, 5);
  });

  it('snapToRoute returns the right distanceAlongM and offsetM for a point beside the line', () => {
    // 100 m due east
    const p0 = ORIGIN;
    const p1 = offsetCoordMeters(ORIGIN, 100, 0);
    const prepared = prepareRoute([p0, p1]);

    // Point 35 m east and 12 m north of the line
    const beside = offsetCoordMeters(ORIGIN, 35, 12);
    const snapped = snapToRoute(prepared, beside);

    expect(Math.abs(snapped.distanceAlongM - 35)).toBeLessThan(0.5);
    expect(Math.abs(snapped.offsetM - 12)).toBeLessThan(0.5);
  });

  it('pointAt, headingAhead, etaMinutes, and isOffRoute behave accurately', () => {
    const p0 = ORIGIN;
    const p1 = offsetCoordMeters(ORIGIN, 0, 80);
    const prepared = prepareRoute([p0, p1]);

    const mid = pointAt(prepared, 40);
    expect(snapToRoute(prepared, mid).distanceAlongM).toBeCloseTo(40, 1);

    expect(Math.abs(headingAhead(prepared, 0, 25) - 0)).toBeLessThan(1);
    expect(etaMinutes(80, 80)).toBe(1);
    expect(etaMinutes(160, 80)).toBe(2);
    expect(isOffRoute(29)).toBe(false);
    expect(isOffRoute(31)).toBe(true);
  });
});

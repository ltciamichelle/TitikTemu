import { describe, expect, it } from 'vitest';
import {
  campusRoutingGraph,
  dijkstra,
  routeBetween,
} from './routing';

const BUILDINGS = {
  R: 'b518483234',
  K: 'b518483236',
  JL: 'b518483239',
  P: 'b518483240',
  M: 'b518483241',
  I: 'b518483242',
} as const;

describe('TitikTemu walking routing engine', () => {
  it('routes Gedung M to Gedung P (~54 m)', () => {
    const res = routeBetween(BUILDINGS.M, BUILDINGS.P);
    expect(res).not.toBeNull();
    expect(Math.abs(res!.meters - 54)).toBeLessThanOrEqual(3);
    expect(res!.usesManual).toBe(false);
  });

  it('routes Gedung M to Gedung I (~81 m)', () => {
    const res = routeBetween(BUILDINGS.M, BUILDINGS.I);
    expect(res).not.toBeNull();
    expect(Math.abs(res!.meters - 81)).toBeLessThanOrEqual(3);
    expect(res!.usesManual).toBe(false);
  });

  it('routes Gedung J dan L to Gedung P (~124 m)', () => {
    const res = routeBetween(BUILDINGS.JL, BUILDINGS.P);
    expect(res).not.toBeNull();
    expect(Math.abs(res!.meters - 124)).toBeLessThanOrEqual(3);
    expect(res!.usesManual).toBe(false);
  });

  it('routes Gedung K to Gedung J dan L (~172 m)', () => {
    const res = routeBetween(BUILDINGS.K, BUILDINGS.JL);
    expect(res).not.toBeNull();
    expect(Math.abs(res!.meters - 172)).toBeLessThanOrEqual(3);
    expect(res!.usesManual).toBe(false);
  });

  it('routes Gedung K to Gedung R (~123 m, usesManual = true)', () => {
    const res = routeBetween(BUILDINGS.K, BUILDINGS.R);
    expect(res).not.toBeNull();
    expect(Math.abs(res!.meters - 123)).toBeLessThanOrEqual(3);
    expect(res!.usesManual).toBe(true);
  });

  it('routes Gedung I to Gedung R (~424 m, usesManual = true)', () => {
    const res = routeBetween(BUILDINGS.I, BUILDINGS.R);
    expect(res).not.toBeNull();
    expect(Math.abs(res!.meters - 424)).toBeLessThanOrEqual(3);
    expect(res!.usesManual).toBe(true);
  });

  it('returns null when no path exists between disconnected components', () => {
    // n0 is component 0, n4 is component 1 (disconnected)
    const res = dijkstra(campusRoutingGraph, 'n0', 'n4');
    expect(res).toBeNull();
  });

  it('returns 0 m when start equals end', () => {
    const res = routeBetween(BUILDINGS.M, BUILDINGS.M);
    expect(res).not.toBeNull();
    expect(res!.meters).toBe(0);
    expect(res!.usesManual).toBe(false);
  });
});

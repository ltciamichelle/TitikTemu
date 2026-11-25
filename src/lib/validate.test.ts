import { describe, expect, it } from 'vitest';
import buildingsRaw from '../data/buildings.geojson?raw';
import buildingInfoData from '../data/buildingInfo.json';
import pathsData from '../data/paths.json';
import type {
  BuildingInfoEntry,
  BuildingInfoMap,
  BuildingsGeoJSON,
  PathsGraph,
} from '../types';
import { extractBuildings } from './geo';
import { campusRoutingGraph } from './routing';
import {
  diffBuildingInfo,
  isValidHoursFormat,
  runGraphChecks,
  serializeBuildingInfo,
  validateAllBuildings,
  validateBuildingEntry,
  validateImportShape,
} from './validate';

const geojson = JSON.parse(buildingsRaw) as BuildingsGeoJSON;
const infoMap = buildingInfoData as unknown as BuildingInfoMap;
const buildings = extractBuildings(geojson, infoMap);
const paths = pathsData as unknown as PathsGraph;

function makeValidEntry(
  overrides: Partial<BuildingInfoEntry> = {}
): BuildingInfoEntry {
  return {
    category: 'admin',
    floorsOverride: 8,
    hours: '07:00-18:00',
    description: 'Main campus administrative building.',
    photo: 'gedung-m.jpg',
    entranceOverride: null,
    verified: true,
    rooms: {
      '1': ['Lobby', 'Front Desk'],
      '2': ['Meeting Room'],
    },
    ...overrides,
  };
}

describe('Admin Lite validation engine (src/lib/validate.ts)', () => {
  const gedungM = buildings.find((b) => b.id === 'b518483241')!;

  it('accepts valid building entries with zero errors and zero warnings', () => {
    const res = validateBuildingEntry({
      building: gedungM,
      entry: makeValidEntry(),
      allBuildings: buildings,
      graph: campusRoutingGraph,
    });
    expect(res.errors).toHaveLength(0);
    expect(res.warnings).toHaveLength(0);
  });

  it('validates 24h hours format plus "24 hours" and "Closed"', () => {
    expect(isValidHoursFormat('07:00-17:30')).toBe(true);
    expect(isValidHoursFormat('00:00-23:59')).toBe(true);
    expect(isValidHoursFormat('24 hours')).toBe(true);
    expect(isValidHoursFormat('Closed')).toBe(true);
    expect(isValidHoursFormat(null)).toBe(true);
    expect(isValidHoursFormat('7:00-17:00')).toBe(false);
    expect(isValidHoursFormat('25:00-26:00')).toBe(false);
    expect(isValidHoursFormat('Mon-Fri 8am-5pm')).toBe(false);
  });

  it('catches all blocking error rules', () => {
    const bad = makeValidEntry({
      category: 'unknown' as unknown as BuildingInfoEntry['category'],
      hours: '9am to 5pm',
      floorsOverride: 65,
      rooms: {
        '1': ['Room A', 'room a'], // duplicate
      },
      entranceOverride: [107.0, -6.5], // far outside campus box
    });
    const res = validateBuildingEntry({
      building: gedungM,
      entry: bad,
      allBuildings: buildings,
      graph: campusRoutingGraph,
    });

    const fields = res.errors.map((e) => e.field);
    expect(fields).toContain('category');
    expect(fields).toContain('hours');
    expect(fields).toContain('floorsOverride');
    expect(fields).toContain('rooms');
    expect(fields).toContain('entranceOverride');
  });

  it('catches rooms listed above floorsOverride', () => {
    const res = validateBuildingEntry({
      building: gedungM,
      entry: makeValidEntry({
        floorsOverride: 5,
        rooms: { '1': ['Lobby'], '7': ['Penthouse'] },
      }),
      allBuildings: buildings,
      graph: campusRoutingGraph,
    });
    expect(res.errors.some((e) => e.field === 'rooms' && e.floor === '7')).toBe(
      true
    );
  });

  it('produces warnings without blocking export', () => {
    const warnEntry = makeValidEntry({
      description: null,
      hours: null,
      photo: 'building_photo_no_ext',
      verified: true,
      rooms: { '1': [] },
    });
    const res = validateBuildingEntry({
      building: gedungM,
      entry: warnEntry,
      allBuildings: buildings,
      graph: campusRoutingGraph,
    });
    expect(res.errors).toHaveLength(0);
    const fields = res.warnings.map((w) => w.field);
    expect(fields).toContain('description');
    expect(fields).toContain('rooms');
    expect(fields).toContain('photo');
    expect(fields).toContain('verified');
  });

  it('runs read-only graph checks (components, connectivity, guessed edges, 6x6 matrix)', () => {
    const report = runGraphChecks(buildings, paths, campusRoutingGraph);
    expect(report.componentCount).toBeGreaterThanOrEqual(1);
    expect(report.buildingConnectivity).toHaveLength(6);
    expect(report.buildingConnectivity.every((b) => b.connectedToMain)).toBe(
      true
    );
    expect(report.guessedEdges.length).toBeGreaterThanOrEqual(1);
    expect(report.unreachablePairs).toHaveLength(0);
    // Spot-check M -> P ~54 m in matrix
    const mp = report.routeMatrix['b518483241']['b518483240'];
    expect(mp.meters).not.toBeNull();
    expect(Math.abs(mp.meters! - 54)).toBeLessThanOrEqual(3);
  });

  it('validates real buildingInfo.json with zero blocking errors', () => {
    const report = validateAllBuildings(infoMap, buildings, campusRoutingGraph);
    expect(report.hasErrors).toBe(false);
  });

  it('preserves key order and _ keys on export, and re-importing produces zero diff', () => {
    const originalWithMeta = {
      _comment: 'keep me',
      ...infoMap,
    };
    const serialized = serializeBuildingInfo(
      infoMap as unknown as Record<string, unknown>,
      originalWithMeta as unknown as Record<string, unknown>
    );
    const parsed = JSON.parse(serialized);
    expect(parsed._comment).toBe('keep me');
    expect(Object.keys(parsed)[0]).toBe('_comment');

    const shape = validateImportShape(parsed);
    expect(shape.ok).toBe(true);
    if (shape.ok) {
      const diffs = diffBuildingInfo(infoMap, shape.data);
      expect(diffs).toHaveLength(0);
    }
  });
});

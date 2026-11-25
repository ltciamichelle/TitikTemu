import type {
  Building,
  BuildingCategory,
  BuildingInfoEntry,
  BuildingInfoMap,
  LngLat,
  PathsGraph,
} from '../types';
import {
  dijkstra,
  isInsideCampusArea,
  snapToGraph,
  type RoutingGraph,
} from './routing';

export const ALLOWED_CATEGORIES = [
  'admin',
  'faculty',
  'facility',
  'food',
  'event',
] as const;

export type ValidationSeverity = 'error' | 'warning';

export type ValidationField =
  | 'category'
  | 'hours'
  | 'description'
  | 'photo'
  | 'floorsOverride'
  | 'entranceOverride'
  | 'rooms'
  | 'verified';

export interface ValidationIssue {
  id: string;
  buildingId: string;
  buildingName: string;
  severity: ValidationSeverity;
  field: ValidationField;
  floor?: string;
  message: string;
}

export interface BuildingValidationSummary {
  buildingId: string;
  status: 'error' | 'unverified' | 'verified';
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  byBuilding: Record<string, BuildingValidationSummary>;
  hasErrors: boolean;
}

export interface GuessedEdgeInfo {
  from: string;
  to: string;
  meters: number;
}

export interface BuildingConnectivityInfo {
  buildingId: string;
  buildingName: string;
  entranceNode: string;
  connectedToMain: boolean;
}

export interface RouteMatrixEntry {
  fromId: string;
  toId: string;
  meters: number | null;
  usesManual: boolean;
}

export interface GraphCheckReport {
  componentCount: number;
  mainComponentSize: number;
  totalNodes: number;
  buildingConnectivity: BuildingConnectivityInfo[];
  guessedEdges: GuessedEdgeInfo[];
  routeMatrix: Record<string, Record<string, { meters: number | null; usesManual: boolean }>>;
  unreachablePairs: { fromName: string; toName: string }[];
}

export interface FieldDiff {
  buildingId: string;
  field: string;
  before: unknown;
  after: unknown;
}

const HOURS_RANGE_RE = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHoursFormat(hours: string | null | undefined): boolean {
  if (hours === null || hours === undefined || hours.trim() === '') return true;
  const trimmed = hours.trim();
  if (trimmed === '24 hours' || trimmed === 'Closed') return true;
  return HOURS_RANGE_RE.test(trimmed);
}

export function isAllowedCategory(
  category: BuildingCategory | string | null | undefined
): boolean {
  if (!category) return false;
  return (ALLOWED_CATEGORIES as readonly string[]).includes(category);
}

export function hasFileExtension(filename: string): boolean {
  return /\.[a-z0-9]{2,5}$/i.test(filename.trim());
}

/**
 * Validate a single building's draft info against all Error and Warning rules.
 */
export function validateBuildingEntry(params: {
  building: Building;
  entry: BuildingInfoEntry;
  allBuildings: Building[];
  graph: RoutingGraph;
}): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const { building, entry, allBuildings, graph } = params;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const bId = building.id;
  const bName = building.name;

  // --- ERRORS (block export) ---
  if (!isAllowedCategory(entry.category)) {
    errors.push({
      id: `${bId}:category`,
      buildingId: bId,
      buildingName: bName,
      severity: 'error',
      field: 'category',
      message: `${bName}: Category must be one of ${ALLOWED_CATEGORIES.join(', ')}.`,
    });
  }

  if (entry.hours && !isValidHoursFormat(entry.hours)) {
    errors.push({
      id: `${bId}:hours`,
      buildingId: bId,
      buildingName: bName,
      severity: 'error',
      field: 'hours',
      message: `${bName}: Hours must be HH:MM-HH:MM (24h), "24 hours", or "Closed".`,
    });
  }

  const floorsVal = entry.floorsOverride;
  const floorsValid =
    floorsVal !== null &&
    floorsVal !== undefined &&
    Number.isInteger(floorsVal) &&
    floorsVal >= 1 &&
    floorsVal <= 60;

  if (!floorsValid) {
    errors.push({
      id: `${bId}:floorsOverride`,
      buildingId: bId,
      buildingName: bName,
      severity: 'error',
      field: 'floorsOverride',
      message: `${bName}: Floors must be a whole number between 1 and 60.`,
    });
  }

  // Room checks: duplicate names on one floor + rooms on a floor above floorsOverride
  const rooms = entry.rooms ?? {};
  for (const [floorKey, list] of Object.entries(rooms)) {
    if (!Array.isArray(list)) continue;

    // Duplicate room name on same floor
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const room of list) {
      const norm = room.trim().toLowerCase();
      if (!norm) continue;
      if (seen.has(norm)) {
        dupes.add(room.trim());
      } else {
        seen.add(norm);
      }
    }
    if (dupes.size > 0) {
      errors.push({
        id: `${bId}:rooms:dupe:${floorKey}`,
        buildingId: bId,
        buildingName: bName,
        severity: 'error',
        field: 'rooms',
        floor: floorKey,
        message: `${bName} (${floorKey === 'B1' ? 'B1' : `L${floorKey}`}): Duplicate room name (${Array.from(dupes).join(', ')}).`,
      });
    }

    // Rooms listed above floorsOverride
    if (
      floorsValid &&
      !/^b/i.test(floorKey) &&
      list.length > 0
    ) {
      const floorNum = Number.parseInt(floorKey, 10);
      if (!Number.isNaN(floorNum) && floorNum > (floorsVal as number)) {
        errors.push({
          id: `${bId}:rooms:above:${floorKey}`,
          buildingId: bId,
          buildingName: bName,
          severity: 'error',
          field: 'rooms',
          floor: floorKey,
          message: `${bName}: Rooms are listed on L${floorNum}, which is above floors (${floorsVal}).`,
        });
      }
    }
  }

  // Entrance override bounds check (6 buildings + 150 m)
  if (entry.entranceOverride) {
    if (!isInsideCampusArea(entry.entranceOverride, allBuildings, 150)) {
      errors.push({
        id: `${bId}:entranceOverride:bounds`,
        buildingId: bId,
        buildingName: bName,
        severity: 'error',
        field: 'entranceOverride',
        message: `${bName}: Entrance override is outside the campus area (150 m margin).`,
      });
    }
  }

  // --- WARNINGS (allow export) ---
  if (!entry.description || entry.description.trim() === '') {
    warnings.push({
      id: `${bId}:description:missing`,
      buildingId: bId,
      buildingName: bName,
      severity: 'warning',
      field: 'description',
      message: `${bName}: Description is missing.`,
    });
  }

  const l1Rooms = rooms['1'] ?? [];
  if (l1Rooms.length === 0) {
    warnings.push({
      id: `${bId}:rooms:emptyL1`,
      buildingId: bId,
      buildingName: bName,
      severity: 'warning',
      field: 'rooms',
      floor: '1',
      message: `${bName}: No rooms listed on L1.`,
    });
  }

  if (entry.photo && entry.photo.trim() !== '' && !hasFileExtension(entry.photo)) {
    warnings.push({
      id: `${bId}:photo:ext`,
      buildingId: bId,
      buildingName: bName,
      severity: 'warning',
      field: 'photo',
      message: `${bName}: Photo filename "${entry.photo}" has no file extension (e.g. .jpg, .png).`,
    });
  }

  if (entry.verified) {
    const missingForVerified: string[] = [];
    if (!entry.hours || entry.hours.trim() === '') missingForVerified.push('hours');
    if (!entry.description || entry.description.trim() === '') {
      missingForVerified.push('description');
    }
    if (!entry.photo || entry.photo.trim() === '') missingForVerified.push('photo');
    if (missingForVerified.length > 0) {
      warnings.push({
        id: `${bId}:verified:emptyFields`,
        buildingId: bId,
        buildingName: bName,
        severity: 'warning',
        field: 'verified',
        message: `${bName}: Marked verified, but ${missingForVerified.join(', ')} ${missingForVerified.length === 1 ? 'is' : 'are'} still empty.`,
      });
    }
  }

  if (entry.entranceOverride) {
    const snap = snapToGraph(entry.entranceOverride, graph);
    if (snap.distanceM > 20) {
      warnings.push({
        id: `${bId}:entranceOverride:far`,
        buildingId: bId,
        buildingName: bName,
        severity: 'warning',
        field: 'entranceOverride',
        message: `${bName}: Entrance override is ${Math.round(snap.distanceM)} m from the nearest road node (> 20 m).`,
      });
    }
  }

  return { errors, warnings };
}

/**
 * Validate all 6 buildings and produce per-building status dots (red / yellow / green).
 */
export function validateAllBuildings(
  infoMap: BuildingInfoMap,
  buildings: Building[],
  graph: RoutingGraph
): ValidationReport {
  const allErrors: ValidationIssue[] = [];
  const allWarnings: ValidationIssue[] = [];
  const byBuilding: Record<string, BuildingValidationSummary> = {};

  for (const building of buildings) {
    const entry: BuildingInfoEntry = infoMap[building.id] ?? {
      category: null,
      floorsOverride: building.floors ?? null,
      hours: null,
      description: null,
      photo: null,
      entranceOverride: null,
      verified: false,
      rooms: {},
    };

    const { errors, warnings } = validateBuildingEntry({
      building,
      entry,
      allBuildings: buildings,
      graph,
    });

    allErrors.push(...errors);
    allWarnings.push(...warnings);

    const status: BuildingValidationSummary['status'] =
      errors.length > 0
        ? 'error'
        : entry.verified
          ? 'verified'
          : 'unverified';

    byBuilding[building.id] = {
      buildingId: building.id,
      status,
      errors,
      warnings,
    };
  }

  return {
    errors: allErrors,
    warnings: allWarnings,
    byBuilding,
    hasErrors: allErrors.length > 0,
  };
}

/**
 * Read-only walking graph diagnostics from paths.json.
 */
export function runGraphChecks(
  buildings: Building[],
  paths: PathsGraph,
  graph: RoutingGraph
): GraphCheckReport {
  // 1. Connected components via BFS
  const visited = new Set<string>();
  const components: Set<string>[] = [];

  for (const nodeId of graph.nodes.keys()) {
    if (visited.has(nodeId)) continue;
    const comp = new Set<string>();
    const queue: string[] = [nodeId];
    visited.add(nodeId);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.add(curr);
      for (const edge of graph.adjacency.get(curr) ?? []) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
    components.push(comp);
  }

  components.sort((a, b) => b.size - a.size);
  const mainComp = components[0] ?? new Set<string>();

  // 2. Building entrance connectivity
  const buildingConnectivity: BuildingConnectivityInfo[] = buildings.map(
    (b) => ({
      buildingId: b.id,
      buildingName: b.name,
      entranceNode: b.entranceNode,
      connectedToMain: mainComp.has(b.entranceNode),
    })
  );

  // 3. Guessed (manual: true) edges
  const guessedEdges: GuessedEdgeInfo[] = paths.edges
    .filter((e) => Boolean(e.manual))
    .map((e) => ({ from: e.from, to: e.to, meters: e.meters }));

  // 4. Shortest route matrix between all 6 buildings
  const routeMatrix: GraphCheckReport['routeMatrix'] = {};
  const unreachablePairs: { fromName: string; toName: string }[] = [];

  for (const a of buildings) {
    routeMatrix[a.id] = {};
    for (const b of buildings) {
      if (a.id === b.id) {
        routeMatrix[a.id][b.id] = { meters: 0, usesManual: false };
        continue;
      }
      const res = dijkstra(graph, a.entranceNode, b.entranceNode);
      if (res) {
        routeMatrix[a.id][b.id] = {
          meters: Math.round(res.meters),
          usesManual: res.usesManual,
        };
      } else {
        routeMatrix[a.id][b.id] = { meters: null, usesManual: false };
        if (a.id < b.id) {
          unreachablePairs.push({ fromName: a.name, toName: b.name });
        }
      }
    }
  }

  return {
    componentCount: components.length,
    mainComponentSize: mainComp.size,
    totalNodes: graph.nodes.size,
    buildingConnectivity,
    guessedEdges,
    routeMatrix,
    unreachablePairs,
  };
}

/**
 * Serialize draft buildingInfo.json preserving original key order and any `_`-prefixed keys.
 */
export function serializeBuildingInfo(
  draft: Record<string, unknown>,
  original: Record<string, unknown>
): string {
  const orderedTop: Record<string, unknown> = {};

  // First keep all keys in original order (including `_` keys)
  for (const key of Object.keys(original)) {
    if (key.startsWith('_')) {
      orderedTop[key] =
        key in draft ? draft[key] : original[key];
      continue;
    }
    const origEntry = original[key];
    const draftEntry = draft[key];
    if (
      origEntry &&
      typeof origEntry === 'object' &&
      !Array.isArray(origEntry) &&
      draftEntry &&
      typeof draftEntry === 'object' &&
      !Array.isArray(draftEntry)
    ) {
      const orderedEntry: Record<string, unknown> = {};
      const origObj = origEntry as Record<string, unknown>;
      const draftObj = draftEntry as Record<string, unknown>;
      for (const ek of Object.keys(origObj)) {
        if (ek.startsWith('_')) {
          orderedEntry[ek] = ek in draftObj ? draftObj[ek] : origObj[ek];
        } else if (ek in draftObj) {
          orderedEntry[ek] = draftObj[ek];
        } else {
          orderedEntry[ek] = origObj[ek];
        }
      }
      for (const ek of Object.keys(draftObj)) {
        if (!(ek in orderedEntry)) {
          orderedEntry[ek] = draftObj[ek];
        }
      }
      orderedTop[key] = orderedEntry;
    } else if (key in draft) {
      orderedTop[key] = draftEntry;
    }
  }

  // Append any extra keys added in draft
  for (const key of Object.keys(draft)) {
    if (!(key in orderedTop)) {
      orderedTop[key] = draft[key];
    }
  }

  return JSON.stringify(orderedTop, null, 2) + '\n';
}

/**
 * Validate raw JSON import shape for buildingInfo.json.
 */
export function validateImportShape(
  parsed: unknown
): { ok: true; data: BuildingInfoMap } | { ok: false; error: string } {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Root JSON must be an object keyed by building id.' };
  }

  const obj = parsed as Record<string, unknown>;
  const buildingKeys = Object.keys(obj).filter((k) => !k.startsWith('_'));
  if (buildingKeys.length === 0) {
    return { ok: false, error: 'No building entries found in JSON.' };
  }

  for (const key of buildingKeys) {
    const val = obj[key];
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return { ok: false, error: `Entry "${key}" must be an object.` };
    }
    const entry = val as Record<string, unknown>;
    if (
      entry.rooms !== undefined &&
      (typeof entry.rooms !== 'object' ||
        entry.rooms === null ||
        Array.isArray(entry.rooms))
    ) {
      return {
        ok: false,
        error: `Entry "${key}.rooms" must be an object keyed by floor.`,
      };
    }
    if (entry.entranceOverride !== undefined && entry.entranceOverride !== null) {
      const eo = entry.entranceOverride;
      if (
        !Array.isArray(eo) ||
        eo.length !== 2 ||
        typeof eo[0] !== 'number' ||
        typeof eo[1] !== 'number'
      ) {
        return {
          ok: false,
          error: `Entry "${key}.entranceOverride" must be [lng, lat] or null.`,
        };
      }
    }
  }

  return { ok: true, data: obj as unknown as BuildingInfoMap };
}

/**
 * Compute per-building field diffs between current draft and incoming import.
 * Exporting and re-importing the same file yields an empty array (no diff).
 */
export function diffBuildingInfo(
  current: BuildingInfoMap,
  incoming: BuildingInfoMap
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const allIds = new Set([
    ...Object.keys(current).filter((k) => !k.startsWith('_')),
    ...Object.keys(incoming).filter((k) => !k.startsWith('_')),
  ]);

  const fieldsToCompare = [
    'category',
    'floorsOverride',
    'oldName',
    'oldNameVerified',
    'verified',
    'sourceNote',
    'hours',
    'description',
    'photo',
    'entranceOverride',
    'rooms',
  ] as const;

  for (const id of allIds) {
    const a = current[id] as unknown as Record<string, unknown> | undefined;
    const b = incoming[id] as unknown as Record<string, unknown> | undefined;

    for (const field of fieldsToCompare) {
      const valA = a?.[field] ?? null;
      const valB = b?.[field] ?? null;
      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        diffs.push({
          buildingId: id,
          field,
          before: valA,
          after: valB,
        });
      }
    }
  }

  return diffs;
}

/**
 * Generate a Markdown validation & graph check report for proposal documentation.
 */
export function generateValidationReportMd(
  validation: ValidationReport,
  graphChecks: GraphCheckReport,
  buildings: Building[]
): string {
  const lines: string[] = [
    '# TitikTemu — Campus Map Validation Report',
    '',
    `Generated locally on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## Summary',
    `- **Errors**: ${validation.errors.length}`,
    `- **Warnings**: ${validation.warnings.length}`,
    `- **Graph connected components**: ${graphChecks.componentCount} (main network: ${graphChecks.mainComponentSize}/${graphChecks.totalNodes} nodes)`,
    `- **Guessed (manual) edges**: ${graphChecks.guessedEdges.length}`,
    '',
    '## Warnings',
  ];

  if (validation.warnings.length === 0) {
    lines.push('- None.');
  } else {
    for (const w of validation.warnings) {
      lines.push(`- ${w.message}`);
    }
  }

  lines.push('', '## Guessed Edges (`manual: true`)');
  if (graphChecks.guessedEdges.length === 0) {
    lines.push('- None.');
  } else {
    for (const e of graphChecks.guessedEdges) {
      lines.push(`- \`${e.from}\` ↔ \`${e.to}\`: **${Math.round(e.meters)} m** (unverified)`);
    }
  }

  lines.push('', '## Building-to-Building Shortest Route Matrix (meters)');
  const header = `| Building | ${buildings.map((b) => b.shortName).join(' | ')} |`;
  const sep = `| --- | ${buildings.map(() => '---:').join(' | ')} |`;
  lines.push(header, sep);

  for (const a of buildings) {
    const cells = buildings.map((b) => {
      const entry = graphChecks.routeMatrix[a.id]?.[b.id];
      if (!entry || entry.meters === null) return 'No route';
      return `${entry.meters} m${entry.usesManual ? '*' : ''}`;
    });
    lines.push(`| ${a.name} | ${cells.join(' | ')} |`);
  }

  lines.push('', '*`*` indicates route uses a guessed (`manual: true`) edge.*');
  return lines.join('\n') + '\n';
}

export function getEntranceSnapDistanceM(
  coord: LngLat,
  graph: RoutingGraph
): number {
  return snapToGraph(coord, graph).distanceM;
}

/**
 * Admin Lite — Local-only building metadata editor & campus map validator.
 *
 * SECURITY NOTE:
 * This page is NOT secure and must NEVER be presented as secure.
 * It has no authentication, no backend, and no network calls.
 * It is gated behind VITE_ENABLE_ADMIN=true (default false) so public builds
 * never bundle or expose it. Real authentication comes with Supabase later.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  MapPin,
  Plus,
  Redo2,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import buildingsRaw from '../../data/buildings.geojson?raw';
import buildingInfoData from '../../data/buildingInfo.json';
import pathsData from '../../data/paths.json';
import { extractBuildings, formatFloorLabel } from '../../lib/geo';
import { campusRoutingGraph } from '../../lib/routing';
import {
  ALLOWED_CATEGORIES,
  diffBuildingInfo,
  generateValidationReportMd,
  getEntranceSnapDistanceM,
  runGraphChecks,
  serializeBuildingInfo,
  validateAllBuildings,
  validateImportShape,
  type FieldDiff,
  type ValidationIssue,
} from '../../lib/validate';
import type {
  BuildingCategory,
  BuildingInfoEntry,
  BuildingInfoMap,
  BuildingsGeoJSON,
  LngLat,
  PathsGraph,
} from '../../types';
import { BuildingCard } from '../BuildingCard';
import { AdminMap } from './AdminMap';
import { AdminValidationPanel } from './AdminValidationPanel';

const LS_ADMIN_DRAFT_KEY = 'titiktemu_admin_draft_v1';
const MAX_HISTORY = 40;

const ORIGINAL_GEOJSON = JSON.parse(buildingsRaw) as BuildingsGeoJSON;
const ORIGINAL_INFO = buildingInfoData as unknown as BuildingInfoMap;
const PATHS_GRAPH = pathsData as unknown as PathsGraph;

function cloneInfoMap(map: BuildingInfoMap): BuildingInfoMap {
  return JSON.parse(JSON.stringify(map)) as BuildingInfoMap;
}

function loadDraftFromStorage(): BuildingInfoMap {
  try {
    const raw = window.localStorage.getItem(LS_ADMIN_DRAFT_KEY);
    if (!raw) return cloneInfoMap(ORIGINAL_INFO);
    const parsed = JSON.parse(raw);
    const check = validateImportShape(parsed);
    return check.ok ? check.data : cloneInfoMap(ORIGINAL_INFO);
  } catch {
    return cloneInfoMap(ORIGINAL_INFO);
  }
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type RightTab = 'edit' | 'preview' | 'validate';

export default function AdminLite() {
  const [draft, setDraft] = useState<BuildingInfoMap>(loadDraftFromStorage);
  const [historyPast, setHistoryPast] = useState<BuildingInfoMap[]>([]);
  const [historyFuture, setHistoryFuture] = useState<BuildingInfoMap[]>([]);

  const buildings = useMemo(
    () => extractBuildings(ORIGINAL_GEOJSON, draft),
    [draft]
  );

  const [selectedId, setSelectedId] = useState<string>(
    () => buildings[0]?.id ?? 'b518483242'
  );
  const [activeFloor, setActiveFloor] = useState<string>('1');
  const [newRoomName, setNewRoomName] = useState('');
  const [rightTab, setRightTab] = useState<RightTab>('edit');
  const [isPickingEntrance, setIsPickingEntrance] = useState(false);

  // Confirm & import modal states
  const [confirmAction, setConfirmAction] = useState<
    null | { kind: 'reset_building' } | { kind: 'reset_all' }
  >(null);
  const [pendingImport, setPendingImport] = useState<{
    data: BuildingInfoMap;
    diffs: FieldDiff[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist draft to localStorage automatically
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_ADMIN_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage quota errors
    }
  }, [draft]);

  const commitDraft = useCallback((next: BuildingInfoMap) => {
    setDraft((prev) => {
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), prev]);
      setHistoryFuture([]);
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setHistoryPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setDraft((curr) => {
        setHistoryFuture((fut) => [curr, ...fut.slice(0, MAX_HISTORY - 1)]);
        return previous;
      });
      return past.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryFuture((fut) => {
      if (fut.length === 0) return fut;
      const next = fut[0];
      setDraft((curr) => {
        setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), curr]);
        return next;
      });
      return fut.slice(1);
    });
  }, []);

  const validation = useMemo(
    () => validateAllBuildings(draft, buildings, campusRoutingGraph),
    [draft, buildings]
  );

  const graphChecks = useMemo(
    () => runGraphChecks(buildings, PATHS_GRAPH, campusRoutingGraph),
    // Buildings' geometry/entrances in GeoJSON never change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === selectedId) ?? buildings[0],
    [buildings, selectedId]
  );

  const selectedEntry: BuildingInfoEntry = draft[selectedId] ?? {
    category: null,
    floorsOverride: selectedBuilding?.floors ?? 1,
    hours: null,
    description: null,
    photo: null,
    entranceOverride: null,
    verified: false,
    rooms: {},
  };

  function updateSelectedEntry(patch: Partial<BuildingInfoEntry>) {
    const next = cloneInfoMap(draft);
    next[selectedId] = {
      ...selectedEntry,
      ...patch,
    };
    commitDraft(next);
  }

  // Floors for the rooms editor
  const maxFloors = Math.max(
    1,
    Math.min(60, selectedEntry.floorsOverride ?? selectedBuilding?.floors ?? 1)
  );
  const floorTabs = useMemo(() => {
    const tabs: string[] = [];
    if (selectedEntry.rooms && 'B1' in selectedEntry.rooms) {
      tabs.push('B1');
    }
    for (let i = 1; i <= maxFloors; i++) {
      tabs.push(String(i));
    }
    return tabs;
  }, [maxFloors, selectedEntry.rooms]);

  const currentFloorRooms = selectedEntry.rooms?.[activeFloor] ?? [];

  // Detect duplicates on current floor for inline warning
  const duplicateNames = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const r of currentFloorRooms) {
      const norm = r.trim().toLowerCase();
      if (!norm) continue;
      if (seen.has(norm)) dupes.add(norm);
      else seen.add(norm);
    }
    return dupes;
  }, [currentFloorRooms]);

  function updateFloorRooms(floorKey: string, nextList: string[]) {
    const nextRooms = { ...(selectedEntry.rooms ?? {}) };
    nextRooms[floorKey] = nextList;
    updateSelectedEntry({ rooms: nextRooms });
  }

  function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newRoomName.trim();
    if (!trimmed) return;
    updateFloorRooms(activeFloor, [...currentFloorRooms, trimmed]);
    setNewRoomName('');
  }

  function handleRenameRoom(idx: number, value: string) {
    const copy = [...currentFloorRooms];
    copy[idx] = value;
    updateFloorRooms(activeFloor, copy);
  }

  function handleDeleteRoom(idx: number) {
    updateFloorRooms(
      activeFloor,
      currentFloorRooms.filter((_, i) => i !== idx)
    );
  }

  function handleMoveRoom(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= currentFloorRooms.length) return;
    const copy = [...currentFloorRooms];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    updateFloorRooms(activeFloor, copy);
  }

  function handlePickEntrance(coord: LngLat) {
    updateSelectedEntry({ entranceOverride: coord });
    setIsPickingEntrance(false);
  }

  const entranceSnapM = selectedEntry.entranceOverride
    ? getEntranceSnapDistanceM(selectedEntry.entranceOverride, campusRoutingGraph)
    : null;

  function handleGoToIssue(issue: ValidationIssue) {
    setSelectedId(issue.buildingId);
    if (issue.floor) setActiveFloor(issue.floor);
    setRightTab('edit');
    window.setTimeout(() => {
      const el = document.getElementById(`admin-field-${issue.field}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLElement) el.focus();
    }, 60);
  }

  function handleExportJson() {
    if (validation.hasErrors) return;
    const json = serializeBuildingInfo(
      draft as unknown as Record<string, unknown>,
      ORIGINAL_INFO as unknown as Record<string, unknown>
    );
    downloadTextFile('buildingInfo.json', json, 'application/json');
  }

  function handleExportReport() {
    const md = generateValidationReportMd(validation, graphChecks, buildings);
    downloadTextFile('campus-validation-report.md', md, 'text/markdown');
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const shape = validateImportShape(parsed);
        if (!shape.ok) {
          setImportError(shape.error);
          return;
        }
        const diffs = diffBuildingInfo(draft, shape.data);
        setPendingImport({ data: shape.data, diffs });
      } catch {
        setImportError('Invalid JSON file. Please check the syntax.');
      }
    };
    reader.readAsText(file);
  }

  function executeConfirmReset() {
    if (!confirmAction) return;
    if (confirmAction.kind === 'reset_building') {
      const next = cloneInfoMap(draft);
      if (ORIGINAL_INFO[selectedId]) {
        next[selectedId] = JSON.parse(
          JSON.stringify(ORIGINAL_INFO[selectedId])
        ) as BuildingInfoEntry;
      }
      commitDraft(next);
    } else if (confirmAction.kind === 'reset_all') {
      commitDraft(cloneInfoMap(ORIGINAL_INFO));
    }
    setConfirmAction(null);
  }

  const statusDotColor = (status: 'error' | 'unverified' | 'verified') =>
    status === 'error'
      ? 'bg-[#EF4444]'
      : status === 'verified'
        ? 'bg-primary'
        : 'bg-[#F59E0B]';

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[#F5FAF8] text-ink">
      {/* Visible Local Admin Banner */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#DCE7E2] bg-ink px-4 py-2.5 text-white">
        <div className="flex items-center gap-2.5">
          <a
            href="#/"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-bold text-white transition-colors hover:bg-white/20"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Back to Map</span>
          </a>
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} strokeWidth={2} className="text-accent" />
            <span className="text-xs font-semibold md:text-sm">
              Local admin. Changes stay in this browser until you export.
            </span>
          </div>
        </div>

        {/* Toolbar: Undo, Redo, Import, Export JSON, Export Report, Reset All */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyPast.length === 0}
            aria-label="Undo"
            title="Undo"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-white/10 px-2.5 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 size={14} strokeWidth={2} />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyFuture.length === 0}
            aria-label="Redo"
            title="Redo"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-white/10 px-2.5 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Redo2 size={14} strokeWidth={2} />
            <span className="hidden sm:inline">Redo</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-bold text-white transition-colors hover:bg-white/20"
          >
            <Upload size={14} strokeWidth={2} />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-bold text-white transition-colors hover:bg-white/20"
          >
            <FileText size={14} strokeWidth={2} />
            <span className="hidden sm:inline">Export report (.md)</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={validation.hasErrors}
            title={
              validation.hasErrors
                ? 'Fix all validation errors before exporting'
                : 'Download buildingInfo.json'
            }
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-ink transition-colors hover:bg-[#25be89] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
          >
            <Download size={14} strokeWidth={2.2} />
            <span>Export buildingInfo.json</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmAction({ kind: 'reset_all' })}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#EF4444]/20 px-3 text-xs font-bold text-[#FCA5A5] transition-colors hover:bg-[#EF4444]/30"
          >
            <RotateCcw size={13} strokeWidth={2} />
            <span className="hidden md:inline">Reset all</span>
          </button>
        </div>
      </header>

      {importError && (
        <div className="flex items-center justify-between bg-[#FEF2F2] px-4 py-2 text-xs font-semibold text-[#991B1B]">
          <span>Import failed: {importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="rounded-full p-1 hover:bg-[#FEE2E2]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main 3-Column Desktop / Stacked Mobile Body */}
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-12">
        {/* Left Building List (horizontal strip on mobile, left sidebar on desktop) */}
        <aside className="shrink-0 border-b border-[#E2EAE6] bg-white p-3 lg:col-span-2 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <p className="mb-2 hidden px-1 text-xs font-bold uppercase tracking-wider text-muted lg:block">
            Buildings ({buildings.length})
          </p>
          <ul className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col">
            {buildings.map((b) => {
              const summary = validation.byBuilding[b.id];
              const isSelected = b.id === selectedId;
              return (
                <li key={b.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(b.id);
                      setActiveFloor('1');
                      setIsPickingEntrance(false);
                    }}
                    className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-button px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-mint font-bold text-ink'
                        : 'bg-[#F7FAF9] font-semibold text-ink hover:bg-mint/40'
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDotColor(
                        summary?.status ?? 'unverified'
                      )}`}
                      title={summary?.status}
                    />
                    <span className="truncate text-xs lg:text-sm">{b.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 hidden flex-col gap-1 border-t border-[#EEF1F0] pt-3 text-[11px] text-muted lg:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#EF4444]" /> Has errors
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Unverified
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Verified &amp; valid
            </span>
          </div>
        </aside>

        {/* Center Map */}
        <div className="relative h-[240px] shrink-0 lg:col-span-5 lg:h-full">
          <AdminMap
            buildings={buildings}
            selectedBuildingId={selectedId}
            entranceOverride={selectedEntry.entranceOverride ?? null}
            isPickingEntrance={isPickingEntrance}
            onSelectBuilding={(id) => {
              setSelectedId(id);
              setActiveFloor('1');
            }}
            onPickEntrance={handlePickEntrance}
          />
        </div>

        {/* Right Form / Live Preview / Validation Panel (bottom sheet on mobile, right column on desktop) */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-card bg-white shadow-soft lg:col-span-5 lg:rounded-none lg:border-l lg:border-[#E2EAE6] lg:shadow-none">
          {/* Sub-tabs */}
          <div className="flex shrink-0 items-center gap-1.5 border-b border-[#EEF1F0] px-4 py-2.5">
            <button
              type="button"
              onClick={() => setRightTab('edit')}
              className={`min-h-[38px] rounded-full px-3.5 text-xs font-bold transition-colors ${
                rightTab === 'edit'
                  ? 'bg-ink text-white'
                  : 'bg-[#F4F8F6] text-muted hover:text-ink'
              }`}
            >
              Edit ({selectedBuilding?.shortName})
            </button>
            <button
              type="button"
              onClick={() => setRightTab('preview')}
              className={`inline-flex min-h-[38px] items-center gap-1 rounded-full px-3.5 text-xs font-bold transition-colors ${
                rightTab === 'preview'
                  ? 'bg-ink text-white'
                  : 'bg-[#F4F8F6] text-muted hover:text-ink'
              }`}
            >
              <Eye size={13} strokeWidth={2} />
              Live Preview
            </button>
            <button
              type="button"
              onClick={() => setRightTab('validate')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors ${
                rightTab === 'validate'
                  ? 'bg-ink text-white'
                  : 'bg-[#F4F8F6] text-muted hover:text-ink'
              }`}
            >
              <span>Validation &amp; Graph</span>
              {validation.errors.length > 0 ? (
                <span className="rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] text-white">
                  {validation.errors.length}
                </span>
              ) : (
                <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] text-[#156A4D]">
                  {validation.warnings.length}w
                </span>
              )}
            </button>
          </div>

          {/* Tab Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {rightTab === 'edit' && selectedBuilding && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-ink">
                      {selectedBuilding.name}
                    </h2>
                    <p className="text-xs font-medium text-muted">
                      ID: <code>{selectedBuilding.id}</code> • Entrance node:{' '}
                      <code>{selectedBuilding.entranceNode}</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ kind: 'reset_building' })}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#EEF1F0] px-3 text-xs font-bold text-ink hover:bg-[#E2E7E5]"
                  >
                    <RotateCcw size={13} strokeWidth={2} />
                    Reset building
                  </button>
                </div>

                {/* Category + Floors + Verified */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="admin-field-category"
                      className="mb-1 block text-xs font-bold text-ink"
                    >
                      Category
                    </label>
                    <select
                      id="admin-field-category"
                      value={selectedEntry.category ?? ''}
                      onChange={(e) =>
                        updateSelectedEntry({
                          category: (e.target.value || null) as BuildingCategory,
                        })
                      }
                      className="min-h-[42px] w-full rounded-button bg-[#F4F8F6] px-3 text-sm font-medium text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select category…</option>
                      {ALLOWED_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-field-floorsOverride"
                      className="mb-1 block text-xs font-bold text-ink"
                    >
                      Floors (1–60)
                    </label>
                    <input
                      id="admin-field-floorsOverride"
                      type="number"
                      min={1}
                      max={60}
                      value={selectedEntry.floorsOverride ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateSelectedEntry({
                          floorsOverride: raw === '' ? null : Number(raw),
                        });
                      }}
                      className="min-h-[42px] w-full rounded-button bg-[#F4F8F6] px-3 text-sm font-medium text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label
                      htmlFor="admin-field-verified"
                      className="flex min-h-[42px] cursor-pointer items-center justify-between rounded-button bg-[#F4F8F6] px-3 text-xs font-bold text-ink"
                    >
                      <span>Verified</span>
                      <input
                        id="admin-field-verified"
                        type="checkbox"
                        checked={Boolean(selectedEntry.verified)}
                        onChange={(e) =>
                          updateSelectedEntry({ verified: e.target.checked })
                        }
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  </div>
                </div>

                {/* Hours + Photo */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="admin-field-hours"
                      className="mb-1 block text-xs font-bold text-ink"
                    >
                      Hours (HH:MM-HH:MM, 24 hours, Closed)
                    </label>
                    <input
                      id="admin-field-hours"
                      type="text"
                      value={selectedEntry.hours ?? ''}
                      onChange={(e) =>
                        updateSelectedEntry({
                          hours: e.target.value === '' ? null : e.target.value,
                        })
                      }
                      placeholder="07:00-18:00"
                      className="min-h-[42px] w-full rounded-button bg-[#F4F8F6] px-3 text-sm font-medium text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-field-photo"
                      className="mb-1 block text-xs font-bold text-ink"
                    >
                      Photo filename (text only)
                    </label>
                    <input
                      id="admin-field-photo"
                      type="text"
                      value={selectedEntry.photo ?? ''}
                      onChange={(e) =>
                        updateSelectedEntry({
                          photo: e.target.value === '' ? null : e.target.value,
                        })
                      }
                      placeholder="/places/gedung-m.jpg"
                      className="min-h-[42px] w-full rounded-button bg-[#F4F8F6] px-3 text-sm font-medium text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="admin-field-description"
                    className="mb-1 block text-xs font-bold text-ink"
                  >
                    Description
                  </label>
                  <textarea
                    id="admin-field-description"
                    rows={2}
                    value={selectedEntry.description ?? ''}
                    onChange={(e) =>
                      updateSelectedEntry({
                        description:
                          e.target.value === '' ? null : e.target.value,
                      })
                    }
                    placeholder="Leave empty until verified on site"
                    className="w-full rounded-button bg-[#F4F8F6] p-3 text-sm font-medium text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Old Name & oldNameVerified (if present) */}
                {selectedEntry.oldName !== undefined && (
                  <div className="grid grid-cols-1 gap-3 rounded-button bg-[#F7FAF9] p-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-ink">
                        Old name
                      </label>
                      <input
                        type="text"
                        value={selectedEntry.oldName ?? ''}
                        onChange={(e) =>
                          updateSelectedEntry({
                            oldName:
                              e.target.value === '' ? null : e.target.value,
                          })
                        }
                        className="min-h-[40px] w-full rounded-xl bg-white px-3 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex min-h-[40px] w-full cursor-pointer items-center justify-between rounded-xl bg-white px-3 text-xs font-bold text-ink">
                        <span>oldNameVerified</span>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedEntry.oldNameVerified)}
                          onChange={(e) =>
                            updateSelectedEntry({
                              oldNameVerified: e.target.checked,
                            })
                          }
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Entrance Override */}
                <div
                  id="admin-field-entranceOverride"
                  tabIndex={-1}
                  className="rounded-button bg-[#F7FAF9] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-ink">
                        Entrance override
                      </p>
                      <p className="text-[11px] font-medium text-muted">
                        {selectedEntry.entranceOverride
                          ? `[${selectedEntry.entranceOverride[0]}, ${selectedEntry.entranceOverride[1]}]`
                          : 'Using default GeoJSON entrance'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsPickingEntrance((p) => !p)}
                        className={`inline-flex min-h-[38px] items-center gap-1 rounded-full px-3 text-xs font-bold transition-colors ${
                          isPickingEntrance
                            ? 'bg-accent text-white'
                            : 'bg-white text-ink shadow-sm hover:bg-mint/50'
                        }`}
                      >
                        <MapPin size={13} strokeWidth={2} />
                        {isPickingEntrance ? 'Cancel pick' : 'Pick on map'}
                      </button>
                      {selectedEntry.entranceOverride && (
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedEntry({ entranceOverride: null })
                          }
                          className="min-h-[38px] rounded-full bg-white px-3 text-xs font-bold text-muted hover:text-ink"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {entranceSnapM !== null && (
                    <p
                      className={`mt-2 flex items-center gap-1 text-xs font-semibold ${
                        entranceSnapM > 20 ? 'text-[#B45309]' : 'text-[#156A4D]'
                      }`}
                    >
                      {entranceSnapM > 20 ? (
                        <AlertTriangle size={13} />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      <span>
                        {Math.round(entranceSnapM)} m to nearest road node
                        {entranceSnapM > 20
                          ? ' (warning: > 20 m from road)'
                          : ''}
                      </span>
                    </p>
                  )}
                </div>

                {/* Rooms Editor */}
                <div
                  id="admin-field-rooms"
                  tabIndex={-1}
                  className="rounded-button border border-[#E5ECE9] p-3.5"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink">
                      Rooms per floor
                    </p>
                    {!(selectedEntry.rooms && 'B1' in selectedEntry.rooms) && (
                      <button
                        type="button"
                        onClick={() => {
                          updateFloorRooms('B1', []);
                          setActiveFloor('B1');
                        }}
                        className="text-xs font-bold text-[#156A4D] hover:underline"
                      >
                        + Add B1
                      </button>
                    )}
                  </div>

                  {/* Floor tabs */}
                  <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
                    {floorTabs.map((fk) => {
                      const active = activeFloor === fk;
                      const count = selectedEntry.rooms?.[fk]?.length ?? 0;
                      return (
                        <button
                          key={fk}
                          type="button"
                          onClick={() => setActiveFloor(fk)}
                          className={`min-h-[36px] shrink-0 rounded-full px-3 text-xs font-bold transition-colors ${
                            active
                              ? 'bg-primary text-white'
                              : 'bg-[#EEF1F0] text-ink hover:bg-mint/60'
                          }`}
                        >
                          {formatFloorLabel(fk)}
                          {count > 0 ? ` (${count})` : ''}
                        </button>
                      );
                    })}
                  </div>

                  {duplicateNames.size > 0 && (
                    <p className="mb-2 rounded-xl bg-[#FEF2F2] px-3 py-1.5 text-xs font-semibold text-[#991B1B]">
                      Duplicate room name detected on{' '}
                      {formatFloorLabel(activeFloor)}.
                    </p>
                  )}

                  {/* Room list */}
                  <ul className="mb-3 flex flex-col gap-1.5">
                    {currentFloorRooms.length === 0 ? (
                      <li className="text-xs font-medium text-muted">
                        No rooms on {formatFloorLabel(activeFloor)}.
                      </li>
                    ) : (
                      currentFloorRooms.map((room, idx) => {
                        const isDupe = duplicateNames.has(
                          room.trim().toLowerCase()
                        );
                        return (
                          <li
                            key={`${activeFloor}-${idx}`}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              value={room}
                              onChange={(e) =>
                                handleRenameRoom(idx, e.target.value)
                              }
                              className={`min-h-[38px] flex-1 rounded-xl px-3 text-xs font-semibold text-ink focus:outline-none focus:ring-2 ${
                                isDupe
                                  ? 'bg-[#FEF2F2] ring-1 ring-[#EF4444] focus:ring-[#EF4444]'
                                  : 'bg-[#F4F8F6] focus:bg-white focus:ring-primary'
                              }`}
                            />
                            <button
                              type="button"
                              aria-label="Move up"
                              disabled={idx === 0}
                              onClick={() => handleMoveRoom(idx, -1)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F8F6] text-ink hover:bg-mint/50 disabled:opacity-35"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="Move down"
                              disabled={idx === currentFloorRooms.length - 1}
                              onClick={() => handleMoveRoom(idx, 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F8F6] text-ink hover:bg-mint/50 disabled:opacity-35"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete room"
                              onClick={() => handleDeleteRoom(idx)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FEE2E2]"
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  {/* Add room form */}
                  <form onSubmit={handleAddRoom} className="flex gap-2">
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder={`Add room on ${formatFloorLabel(activeFloor)}…`}
                      className="min-h-[40px] flex-1 rounded-xl bg-[#F4F8F6] px-3 text-xs font-medium text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="submit"
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-primary px-3.5 text-xs font-bold text-white hover:bg-[#25be89]"
                    >
                      <Plus size={14} strokeWidth={2.2} />
                      Add
                    </button>
                  </form>
                </div>
              </div>
            )}

            {rightTab === 'preview' && selectedBuilding && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted">
                  Live preview of the public Building Card using your current
                  draft:
                </p>
                <BuildingCard
                  building={selectedBuilding}
                  onClose={() => setRightTab('edit')}
                  variant="sidebar"
                />
              </div>
            )}

            {rightTab === 'validate' && (
              <AdminValidationPanel
                validation={validation}
                graphChecks={graphChecks}
                buildings={buildings}
                onGoToIssue={handleGoToIssue}
              />
            )}
          </div>
        </section>
      </div>

      {/* Confirm Reset Modal */}
      {confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-[360px] rounded-card bg-white p-5 shadow-soft">
            <h2 className="text-base font-bold text-ink">
              {confirmAction.kind === 'reset_all'
                ? 'Reset all buildings?'
                : `Reset ${selectedBuilding?.name}?`}
            </h2>
            <p className="mt-1.5 text-xs font-medium text-muted">
              This reverts your local draft back to the original
              buildingInfo.json. You can still undo right after.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="min-h-[44px] flex-1 rounded-button bg-[#EEF1F0] text-sm font-bold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmReset}
                className="min-h-[44px] flex-1 rounded-button bg-[#EF4444] text-sm font-bold text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import JSON Diff Confirmation Modal */}
      {pendingImport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-[460px] rounded-card bg-white p-5 shadow-soft">
            <h2 className="text-base font-bold text-ink">
              Confirm JSON Import
            </h2>
            <p className="mt-1 text-xs font-medium text-muted">
              {pendingImport.diffs.length === 0
                ? 'No differences found — this file matches your current draft.'
                : `${pendingImport.diffs.length} field change(s) detected:`}
            </p>

            {pendingImport.diffs.length > 0 && (
              <ul className="mt-3 flex max-h-[220px] flex-col gap-1.5 overflow-y-auto rounded-button bg-[#F7FAF9] p-3 text-xs">
                {pendingImport.diffs.map((d, i) => (
                  <li key={`${d.buildingId}-${d.field}-${i}`}>
                    <strong className="text-ink">{d.buildingId}</strong> →{' '}
                    <code>{d.field}</code>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="min-h-[44px] flex-1 rounded-button bg-[#EEF1F0] text-sm font-bold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  commitDraft(pendingImport.data);
                  setPendingImport(null);
                }}
                className="min-h-[44px] flex-1 rounded-button bg-primary text-sm font-bold text-white"
              >
                Apply import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

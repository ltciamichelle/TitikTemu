import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import buildingsRaw from '../data/buildings.geojson?raw';
import buildingInfoData from '../data/buildingInfo.json';
import pathsData from '../data/paths.json';
import type { Breakpoint } from '../hooks/useMediaQuery';
import {
  buildRoadsGeoJSON,
  CAMPUS_CENTER,
  computeCampusBounds,
  DEMO_USER_POSITION,
  extractBuildings,
  getMapPadding,
  INITIAL_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
} from '../lib/geo';
import { createPastelMapStyle } from '../lib/mapStyle';
import { useAppStore } from '../store/useAppStore';
import type {
  Building,
  BuildingInfoMap,
  BuildingsGeoJSON,
  PathsGraph,
} from '../types';
import { PlaceMarker } from './PlaceMarker';
import { UserDot } from './UserDot';

// Optionally load src/data/context.geojson if it exists
const contextModules = import.meta.glob('../data/context.geojson', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export interface MapViewHandle {
  flyToBuilding: (id: string) => void;
  fitAllBuildings: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface MapViewProps {
  buildings: Building[];
  breakpoint: Breakpoint;
  onSelectBuilding: (id: string) => void;
}

interface MarkerPortalEntry {
  id: string;
  building: Building;
  container: HTMLDivElement;
}

export const campusBuildingsGeoJSON = JSON.parse(buildingsRaw) as BuildingsGeoJSON;
export const campusBuildings: Building[] = extractBuildings(
  campusBuildingsGeoJSON,
  buildingInfoData as unknown as BuildingInfoMap
);

const LABEL_MIN_DISTANCE_PX = 60;

export const MapView = forwardRef<MapViewHandle, MapViewProps>(
  function MapView({ buildings, breakpoint, onSelectBuilding }, ref) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const breakpointRef = useRef<Breakpoint>(breakpoint);
    breakpointRef.current = breakpoint;

    const [mapReady, setMapReady] = useState(false);
    const [zoom, setZoom] = useState(INITIAL_ZOOM);
    const [markerPortals, setMarkerPortals] = useState<MarkerPortalEntry[]>([]);
    const [userDotEl, setUserDotEl] = useState<HTMLDivElement | null>(null);
    const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(
      null
    );
    const [hiddenLabelIds, setHiddenLabelIds] = useState<Set<string>>(
      () => new Set()
    );

    const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
    const clearSelection = useAppStore((s) => s.clearSelection);
    const selectedIdRef = useRef<string | null>(selectedBuildingId);
    selectedIdRef.current = selectedBuildingId;

    const buildingsById = useMemo(
      () => new Map(buildings.map((b) => [b.id, b])),
      [buildings]
    );

    const campusBounds = useMemo(
      () => computeCampusBounds(buildings, DEMO_USER_POSITION),
      [buildings]
    );

    const style = useMemo(() => {
      const roads = buildRoadsGeoJSON(pathsData as unknown as PathsGraph);
      const contextRaw = Object.values(contextModules)[0];
      const contextGeoJSON = contextRaw
        ? (JSON.parse(contextRaw) as GeoJSON.FeatureCollection)
        : null;

      return createPastelMapStyle({
        buildings: campusBuildingsGeoJSON,
        roads,
        contextGeoJSON,
      });
    }, []);

    // Compute overlapping labels (< 60px apart) so non-selected labels hide cleanly
    const recomputeLabelOverlaps = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;

      const selectedId = selectedIdRef.current;
      // Selected building gets highest priority so its label is never hidden
      const ordered = [...buildings].sort((a, b) => {
        if (a.id === selectedId) return -1;
        if (b.id === selectedId) return 1;
        return 0;
      });

      const keptPoints: { x: number; y: number }[] = [];
      const hidden = new Set<string>();

      for (const b of ordered) {
        const pt = map.project(b.centroid);
        const overlapsExisting = keptPoints.some(
          (other) =>
            Math.hypot(pt.x - other.x, pt.y - other.y) < LABEL_MIN_DISTANCE_PX
        );
        if (overlapsExisting && b.id !== selectedId) {
          hidden.add(b.id);
        } else {
          keptPoints.push({ x: pt.x, y: pt.y });
        }
      }

      setHiddenLabelIds(hidden);
    }, [buildings]);

    const fitAll = useCallback(
      (bp: Breakpoint, animate = true) => {
        const map = mapRef.current;
        if (!map) return;
        const padding = getMapPadding(bp, Boolean(selectedIdRef.current));
        map.fitBounds(campusBounds, {
          padding,
          maxZoom: 18.2,
          duration: animate ? 500 : 0,
        });
      },
      [campusBounds]
    );

    useImperativeHandle(
      ref,
      () => ({
        flyToBuilding(id: string) {
          const map = mapRef.current;
          const b = buildingsById.get(id);
          if (!map || !b) return;
          const padding = getMapPadding(breakpointRef.current, true);
          map.easeTo({
            center: b.centroid,
            zoom: Math.max(map.getZoom(), 17.6),
            padding,
            duration: 600,
          });
        },
        fitAllBuildings() {
          fitAll(breakpointRef.current, true);
        },
        zoomIn() {
          mapRef.current?.zoomIn({ duration: 250 });
        },
        zoomOut() {
          mapRef.current?.zoomOut({ duration: 250 });
        },
      }),
      [buildingsById, fitAll]
    );

    useEffect(() => {
      const containerEl = mapContainerRef.current;
      if (!containerEl) return;

      const map = new maplibregl.Map({
        container: containerEl,
        style,
        center: CAMPUS_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        scrollZoom: true,
        dragPan: true,
        attributionControl: false,
      });

      mapRef.current = map;
      const createdMarkers: maplibregl.Marker[] = [];

      map.on('load', () => {
        setMapReady(true);

        // Fit all 6 buildings + UserDot with responsive padding on initial load
        const initialPadding = getMapPadding(
          breakpointRef.current,
          Boolean(selectedIdRef.current)
        );
        map.fitBounds(campusBounds, {
          padding: initialPadding,
          maxZoom: 18.2,
          duration: 0,
        });
        setZoom(map.getZoom());

        // Create HTML markers for each building centroid
        const portals: MarkerPortalEntry[] = buildings.map((building) => {
          const el = document.createElement('div');
          const marker = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(building.centroid)
            .addTo(map);
          createdMarkers.push(marker);
          return { id: building.id, building, container: el };
        });
        setMarkerPortals(portals);

        // Create UserDot marker at fixed demo position
        const uEl = document.createElement('div');
        const userMarker = new maplibregl.Marker({
          element: uEl,
          anchor: 'bottom',
        })
          .setLngLat(DEMO_USER_POSITION)
          .addTo(map);
        createdMarkers.push(userMarker);
        setUserDotEl(uEl);

        recomputeLabelOverlaps();
      });

      map.on('zoom', () => {
        setZoom(map.getZoom());
        recomputeLabelOverlaps();
      });

      map.on('moveend', () => {
        recomputeLabelOverlaps();
      });

      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['buildings-fill'],
        });
        if (features.length > 0) {
          const clickedId = features[0].properties?.id as string | undefined;
          if (clickedId) {
            onSelectBuilding(clickedId);
            return;
          }
        }
        clearSelection();
      });

      map.on('mouseenter', 'buildings-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'buildings-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      // Keep map sized cleanly on window / container resize
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
        recomputeLabelOverlaps();
      });
      resizeObserver.observe(containerEl);

      return () => {
        resizeObserver.disconnect();
        createdMarkers.forEach((m) => m.remove());
        map.remove();
        mapRef.current = null;
        setMapReady(false);
        setMarkerPortals([]);
        setUserDotEl(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [style]);

    // Sync selected building highlight filter + recompute overlaps
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      const filterValue = selectedBuildingId ?? '';
      map.setFilter('buildings-selected-fill', [
        '==',
        ['get', 'id'],
        filterValue,
      ]);
      map.setFilter('buildings-selected-edge', [
        '==',
        ['get', 'id'],
        filterValue,
      ]);
      recomputeLabelOverlaps();
    }, [selectedBuildingId, mapReady, recomputeLabelOverlaps]);

    // Re-apply responsive padding & resize whenever breakpoint changes
    const prevBreakpointRef = useRef<Breakpoint>(breakpoint);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      if (prevBreakpointRef.current === breakpoint) return;
      prevBreakpointRef.current = breakpoint;

      map.resize();
      const padding = getMapPadding(breakpoint, Boolean(selectedBuildingId));
      if (selectedBuildingId) {
        const b = buildingsById.get(selectedBuildingId);
        if (b) {
          map.easeTo({ center: b.centroid, padding, duration: 400 });
          return;
        }
      }
      map.fitBounds(campusBounds, {
        padding,
        maxZoom: 18.2,
        duration: 400,
      });
    }, [breakpoint, mapReady, selectedBuildingId, buildingsById, campusBounds]);

    const showLabels = zoom >= 16.5;

    return (
      <div className="relative h-full w-full">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Building PlaceMarker portals */}
        {markerPortals.map(({ id, building, container }) =>
          createPortal(
            <PlaceMarker
              key={id}
              building={building}
              isSelected={selectedBuildingId === id}
              showLabel={showLabels}
              isLabelHiddenByOverlap={
                hiddenLabelIds.has(id) && hoveredBuildingId !== id
              }
              onSelect={onSelectBuilding}
              onHoverChange={setHoveredBuildingId}
            />,
            container
          )
        )}

        {/* Fixed demo UserDot portal */}
        {userDotEl && createPortal(<UserDot />, userDotEl)}
      </div>
    );
  }
);

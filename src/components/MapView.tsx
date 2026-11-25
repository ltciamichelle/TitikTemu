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
import { ENABLE_3D, FLOOR_HEIGHT_M } from '../lib/constants';
import {
  buildRoadsGeoJSON,
  CAMPUS_CENTER,
  computeCampusBounds,
  computeCoordsBounds,
  computeRoofLiftPx,
  DEMO_USER_POSITION,
  enrichBuildingsGeoJSON,
  extractBuildings,
  filterContextFor3D,
  getEstimatedBuildingHeightM,
  getMapPadding,
  INITIAL_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
} from '../lib/geo';
import { createPastelMapStyle } from '../lib/mapStyle';
import { isVisibleOnMap } from '../lib/friendsRepo';
import { routeToGeoJSON } from '../lib/routing';
import { useAppStore } from '../store/useAppStore';
import type {
  Building,
  BuildingInfoMap,
  BuildingsGeoJSON,
  FriendRecord,
  LngLat,
  PathsGraph,
} from '../types';
import { FriendPin } from './FriendPin';
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
  flyToCoord: (coord: [number, number]) => void;
  fitAllBuildings: () => void;
  resetNorth: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface MapViewProps {
  buildings: Building[];
  breakpoint: Breakpoint;
  onSelectBuilding: (id: string) => void;
  onSelectFriend: (userId: string) => void;
  onBearingChange?: (bearing: number) => void;
}

interface MarkerPortalEntry {
  id: string;
  building: Building;
  container: HTMLDivElement;
}

interface FriendPortalEntry {
  userId: string;
  friend: FriendRecord;
  container: HTMLDivElement;
}

/**
 * Compute a building-ring offset coordinate so friends at the same building
 * sit neatly around the building marker without overlapping or exposing exact GPS.
 */
function computeFriendRingCoord(
  centroid: LngLat,
  index: number,
  totalInBuilding: number
): LngLat {
  const angle = -Math.PI / 4 + (index * 2 * Math.PI) / Math.max(totalInBuilding, 3);
  const radiusLng = 0.00017;
  const radiusLat = 0.00016;
  return [
    centroid[0] + Math.cos(angle) * radiusLng,
    centroid[1] + Math.sin(angle) * radiusLat,
  ];
}

export const campusBuildingsGeoJSON = JSON.parse(buildingsRaw) as BuildingsGeoJSON;
export const campusBuildings: Building[] = extractBuildings(
  campusBuildingsGeoJSON,
  buildingInfoData as unknown as BuildingInfoMap
);
const enrichedBuildingsGeoJSON = enrichBuildingsGeoJSON(
  campusBuildingsGeoJSON,
  buildingInfoData as unknown as BuildingInfoMap
);

const LABEL_MIN_DISTANCE_PX = 60;

const LAYERS_2D = [
  'context-buildings-fill',
  'buildings-fill',
  'buildings-edge',
  'buildings-selected-fill',
  'buildings-selected-edge',
] as const;

const LAYERS_3D = [
  'context-3d',
  'buildings-3d',
  'selected-floor-3d',
] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(
  function MapView(
    { buildings, breakpoint, onSelectBuilding, onSelectFriend, onBearingChange },
    ref
  ) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const userMarkerRef = useRef<maplibregl.Marker | null>(null);
    const friendMarkersRef = useRef<
      Map<string, { marker: maplibregl.Marker; container: HTMLDivElement }>
    >(new Map());
    const breakpointRef = useRef<Breakpoint>(breakpoint);
    breakpointRef.current = breakpoint;
    const onBearingChangeRef = useRef(onBearingChange);
    onBearingChangeRef.current = onBearingChange;

    const [mapReady, setMapReady] = useState(false);
    const [zoom, setZoom] = useState(INITIAL_ZOOM);
    const [pitch, setPitch] = useState(0);
    const [markerPortals, setMarkerPortals] = useState<MarkerPortalEntry[]>([]);
    const [friendPortals, setFriendPortals] = useState<FriendPortalEntry[]>([]);
    const [userDotEl, setUserDotEl] = useState<HTMLDivElement | null>(null);
    const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(
      null
    );
    const [hiddenLabelIds, setHiddenLabelIds] = useState<Set<string>>(
      () => new Set()
    );

    const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
    const selectedFloor = useAppStore((s) => s.selectedFloor);
    const selectedFriendId = useAppStore((s) => s.selectedFriendId);
    const mapMode = useAppStore((s) => s.mapMode);
    const is3D = ENABLE_3D && mapMode === '3d';
    const userPosition = useAppStore((s) => s.userPosition);
    const route = useAppStore((s) => s.route);
    const routeStatus = useAppStore((s) => s.routeStatus);
    const friends = useAppStore((s) => s.friends);
    const visibleFriendIds = useAppStore((s) => s.visibleFriendIds);
    const myPresence = useAppStore((s) => s.myPresence);
    const clearSelection = useAppStore((s) => s.clearSelection);
    const selectedIdRef = useRef<string | null>(selectedBuildingId);
    selectedIdRef.current = selectedBuildingId;
    const is3DRef = useRef(is3D);
    is3DRef.current = is3D;
    const routeStatusRef = useRef(routeStatus);
    routeStatusRef.current = routeStatus;
    const userPositionRef = useRef(userPosition);
    userPositionRef.current = userPosition;

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
      const context3DGeoJSON = filterContextFor3D(contextGeoJSON);

      return createPastelMapStyle({
        buildings: enrichedBuildingsGeoJSON,
        roads,
        contextGeoJSON,
        context3DGeoJSON,
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
        flyToCoord(coord: [number, number]) {
          const map = mapRef.current;
          if (!map) return;
          const padding = getMapPadding(
            breakpointRef.current,
            Boolean(selectedIdRef.current)
          );
          map.easeTo({
            center: coord,
            zoom: Math.max(map.getZoom(), 17.6),
            padding,
            duration: 550,
          });
        },
        fitAllBuildings() {
          fitAll(breakpointRef.current, true);
        },
        resetNorth() {
          mapRef.current?.easeTo({
            bearing: 0,
            duration: prefersReducedMotion() ? 0 : 450,
          });
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
        maxPitch: 60,
        scrollZoom: true,
        dragPan: true,
        dragRotate: true,
        touchPitch: true,
        attributionControl: false,
      });

      mapRef.current = map;
      const createdMarkers: maplibregl.Marker[] = [];

      map.on('load', () => {
        // Calm soft lighting for 3D pastel extrusions
        map.setLight({
          anchor: 'viewport',
          color: '#ffffff',
          intensity: 0.4,
        });
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

        // Create UserDot marker at current user position (defaults to demo position)
        const uEl = document.createElement('div');
        const userMarker = new maplibregl.Marker({
          element: uEl,
          anchor: 'bottom',
        })
          .setLngLat(userPositionRef.current)
          .addTo(map);
        userMarkerRef.current = userMarker;
        createdMarkers.push(userMarker);
        setUserDotEl(uEl);

        recomputeLabelOverlaps();
      });

      const syncCameraMetrics = () => {
        setZoom(map.getZoom());
        setPitch(map.getPitch());
        onBearingChangeRef.current?.(map.getBearing());
      };

      map.on('zoom', () => {
        syncCameraMetrics();
        recomputeLabelOverlaps();
      });

      map.on('pitch', () => {
        syncCameraMetrics();
      });

      map.on('rotate', () => {
        onBearingChangeRef.current?.(map.getBearing());
      });

      map.on('move', () => {
        syncCameraMetrics();
      });

      map.on('moveend', () => {
        syncCameraMetrics();
        recomputeLabelOverlaps();
      });

      map.on('click', (e) => {
        const queryLayers = is3DRef.current
          ? ['buildings-3d']
          : ['buildings-fill'];
        const features = map.queryRenderedFeatures(e.point, {
          layers: queryLayers,
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

      const handleMouseEnter = () => {
        map.getCanvas().style.cursor = 'pointer';
      };
      const handleMouseLeave = () => {
        map.getCanvas().style.cursor = '';
      };
      map.on('mouseenter', 'buildings-fill', handleMouseEnter);
      map.on('mouseleave', 'buildings-fill', handleMouseLeave);
      map.on('mouseenter', 'buildings-3d', handleMouseEnter);
      map.on('mouseleave', 'buildings-3d', handleMouseLeave);

      // Keep map sized cleanly on window / container resize
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
        recomputeLabelOverlaps();
      });
      resizeObserver.observe(containerEl);

      return () => {
        resizeObserver.disconnect();
        createdMarkers.forEach((m) => m.remove());
        friendMarkersRef.current.forEach(({ marker }) => marker.remove());
        friendMarkersRef.current.clear();
        userMarkerRef.current = null;
        map.remove();
        mapRef.current = null;
        setMapReady(false);
        setMarkerPortals([]);
        setFriendPortals([]);
        setUserDotEl(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [style]);

    // Sync 2D vs 3D layer visibility + camera pitch/bearing without rebuilding sources
    const prev3DRef = useRef<boolean | null>(null);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      for (const layerId of LAYERS_2D) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            'visibility',
            is3D ? 'none' : 'visible'
          );
        }
      }
      for (const layerId of LAYERS_3D) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            'visibility',
            is3D ? 'visible' : 'none'
          );
        }
      }

      // Animate camera only when mode actually toggles (or on initial 3D mount)
      if (prev3DRef.current !== is3D) {
        const wasNull = prev3DRef.current === null;
        prev3DRef.current = is3D;
        if (!wasNull || is3D) {
          const targetPitch = is3D
            ? routeStatusRef.current === 'active'
              ? 45
              : 55
            : 0;
          const targetBearing = is3D ? -20 : 0;
          map.easeTo({
            pitch: targetPitch,
            bearing: targetBearing,
            duration: prefersReducedMotion() ? 0 : 700,
          });
        }
      }
    }, [is3D, mapReady]);

    // Sync selected building highlight (2D) + selected floor slab (3D)
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

      // Update only filter & paint properties of selected-floor-3d (no source rebuild)
      if (map.getLayer('selected-floor-3d')) {
        map.setFilter('selected-floor-3d', [
          '==',
          ['get', 'id'],
          is3D && selectedBuildingId ? selectedBuildingId : '',
        ]);

        if (selectedBuildingId) {
          const isBasement = /^b/i.test(selectedFloor);
          const floorNum = isBasement
            ? 1
            : Math.max(1, Number.parseInt(selectedFloor, 10) || 1);
          const baseM = isBasement ? 0 : (floorNum - 1) * FLOOR_HEIGHT_M;
          const heightM = isBasement ? 1.8 : floorNum * FLOOR_HEIGHT_M;
          map.setPaintProperty(
            'selected-floor-3d',
            'fill-extrusion-base',
            baseM
          );
          map.setPaintProperty(
            'selected-floor-3d',
            'fill-extrusion-height',
            heightM
          );
        }
      }

      recomputeLabelOverlaps();
    }, [selectedBuildingId, selectedFloor, is3D, mapReady, recomputeLabelOverlaps]);

    // Sync userPosition onto UserDot marker
    useEffect(() => {
      userMarkerRef.current?.setLngLat(userPosition);
    }, [userPosition]);

    // Sync visible FriendPin markers around their building centroids (enforced by isVisibleOnMap)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      const now = Date.now();
      const visibleFriends = friends.filter((f) =>
        isVisibleOnMap(
          {
            friendship: f.friendship,
            presence: f.presence,
            visibleToMe: visibleFriendIds.includes(f.user.id),
          },
          now
        )
      );

      // Group by buildingId to compute non-overlapping ring positions
      const groupedByBuilding = new Map<string, FriendRecord[]>();
      for (const f of visibleFriends) {
        const bId = f.presence.buildingId;
        if (!bId) continue;
        const list = groupedByBuilding.get(bId) ?? [];
        list.push(f);
        groupedByBuilding.set(bId, list);
      }

      const activeIds = new Set(visibleFriends.map((f) => f.user.id));

      // Remove markers for friends no longer visible
      for (const [id, entry] of friendMarkersRef.current.entries()) {
        if (!activeIds.has(id)) {
          entry.marker.remove();
          friendMarkersRef.current.delete(id);
        }
      }

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const rafIds: number[] = [];
      const nextPortals: FriendPortalEntry[] = [];

      for (const [bId, list] of groupedByBuilding.entries()) {
        const building = buildingsById.get(bId);
        if (!building) continue;

        list.forEach((friend, idx) => {
          const targetCoord = computeFriendRingCoord(
            building.centroid,
            idx,
            list.length
          );
          const existing = friendMarkersRef.current.get(friend.user.id);

          if (existing) {
            const current = existing.marker.getLngLat();
            const moved =
              Math.abs(current.lng - targetCoord[0]) > 1e-6 ||
              Math.abs(current.lat - targetCoord[1]) > 1e-6;

            if (moved && !prefersReducedMotion) {
              const startLng = current.lng;
              const startLat = current.lat;
              const startTime = performance.now();
              const duration = 600;
              const step = (ts: number) => {
                const t = Math.min(1, (ts - startTime) / duration);
                const ease = 1 - Math.pow(1 - t, 3);
                existing.marker.setLngLat([
                  startLng + (targetCoord[0] - startLng) * ease,
                  startLat + (targetCoord[1] - startLat) * ease,
                ]);
                if (t < 1) {
                  rafIds.push(requestAnimationFrame(step));
                }
              };
              rafIds.push(requestAnimationFrame(step));
            } else {
              existing.marker.setLngLat(targetCoord);
            }

            nextPortals.push({
              userId: friend.user.id,
              friend,
              container: existing.container,
            });
          } else {
            const el = document.createElement('div');
            const marker = new maplibregl.Marker({
              element: el,
              anchor: 'bottom',
            })
              .setLngLat(targetCoord)
              .addTo(map);
            friendMarkersRef.current.set(friend.user.id, {
              marker,
              container: el,
            });
            nextPortals.push({
              userId: friend.user.id,
              friend,
              container: el,
            });
          }
        });
      }

      setFriendPortals(nextPortals);

      return () => {
        rafIds.forEach((id) => cancelAnimationFrame(id));
      };
    }, [friends, visibleFriendIds, mapReady, buildingsById]);

    // Sync active walking route GeoJSON + entrance dot + fitBounds
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      const routeSource = map.getSource('route') as
        | maplibregl.GeoJSONSource
        | undefined;
      routeSource?.setData(routeToGeoJSON(route));

      const entranceSource = map.getSource('route-entrance') as
        | maplibregl.GeoJSONSource
        | undefined;
      if (route?.destinationEntrance) {
        entranceSource?.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: route.destinationEntrance,
              },
            },
          ],
        });
      } else {
        entranceSource?.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }

      if (route && route.coords.length >= 2) {
        const padding = getMapPadding(breakpointRef.current, true);
        map.fitBounds(computeCoordsBounds(route.coords), {
          padding,
          maxZoom: 18.5,
          pitch: is3DRef.current ? 45 : 0,
          duration: prefersReducedMotion() ? 0 : 550,
        });
      }
    }, [route, mapReady]);

    // Re-apply responsive padding & resize whenever breakpoint changes
    const prevBreakpointRef = useRef<Breakpoint>(breakpoint);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      if (prevBreakpointRef.current === breakpoint) return;
      prevBreakpointRef.current = breakpoint;

      map.resize();
      const padding = getMapPadding(breakpoint, Boolean(selectedBuildingId));
      if (route && route.coords.length >= 2) {
        map.fitBounds(computeCoordsBounds(route.coords), {
          padding,
          maxZoom: 18.5,
          duration: 400,
        });
        return;
      }
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
    }, [
      breakpoint,
      mapReady,
      selectedBuildingId,
      route,
      buildingsById,
      campusBounds,
    ]);

    const showLabels = zoom >= 16.5;

    return (
      <div className="relative h-full w-full">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Building PlaceMarker portals (lifted to roof in 3D; only selected label in 3D) */}
        {markerPortals.map(({ id, building, container }) => {
          const isSelected = selectedBuildingId === id;
          const liftOffsetPx = is3D
            ? computeRoofLiftPx(
                getEstimatedBuildingHeightM(building),
                building.centroid[1],
                zoom,
                pitch
              )
            : 0;
          return createPortal(
            <PlaceMarker
              key={id}
              building={building}
              isSelected={isSelected}
              showLabel={is3D ? isSelected : showLabels}
              isLabelHiddenByOverlap={
                is3D ? false : hiddenLabelIds.has(id) && hoveredBuildingId !== id
              }
              liftOffsetPx={liftOffsetPx}
              onSelect={onSelectBuilding}
              onHoverChange={setHoveredBuildingId}
            />,
            container
          );
        })}

        {/* Visible FriendPin portals */}
        {friendPortals.map(({ userId, friend, container }) =>
          createPortal(
            <FriendPin
              key={userId}
              friend={friend}
              isSelected={selectedFriendId === userId}
              onSelect={onSelectFriend}
            />,
            container
          )
        )}

        {/* UserDot portal (shows status bubble only when sharing and not in ghost mode) */}
        {userDotEl &&
          createPortal(
            <UserDot
              status={myPresence.status}
              showStatusBubble={myPresence.shareOn && !myPresence.ghost}
            />,
            userDotEl
          )}
      </div>
    );
  }
);

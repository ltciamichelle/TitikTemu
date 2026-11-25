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
import buildingStyleData from '../data/buildingStyle.json';
import pathsData from '../data/paths.json';
import type { Breakpoint } from '../hooks/useMediaQuery';
import {
  ARRIVAL_THRESHOLD_M,
  BEARING_SMOOTHING,
  GPS_MAX_ACCURACY_M,
  GPS_SMOOTHING_WINDOW,
  LOOKAHEAD_M,
  MAX_PITCH,
  NAV_BOTTOM_PADDING_EXTRA,
  NAV_FRAME_INTERVAL_MS,
  NAV_PITCH,
  NAV_ROUTE_PANEL_HEIGHT_DESKTOP,
  NAV_ROUTE_PANEL_HEIGHT_MOBILE,
  NAV_ROUTE_UPDATE_INTERVAL_MS,
  NAV_TOP_PADDING_DESKTOP,
  NAV_TOP_PADDING_MOBILE,
  NAV_ZOOM,
  OFF_ROUTE_CONSECUTIVE_FIXES,
  OVERVIEW_3D_BEARING,
  OVERVIEW_3D_PITCH,
  OVERVIEW_3D_ROUTE_PITCH,
  SIM_WALK_SPEED_MPS,
} from '../lib/cameraConfig';
import {
  CAMPUS_GEOLOCATION_MARGIN_M,
  ENABLE_3D,
  ENABLE_ILLUSTRATED,
  ENABLE_NAV3D,
  FLOOR_HEIGHT_M,
} from '../lib/constants';
import { isVisibleOnMap } from '../lib/friendsRepo';
import {
  getIllustratedAssets,
  type BuildingStyleMap,
} from '../lib/illustrated';
import {
  buildRoadsGeoJSON,
  CAMPUS_CENTER,
  computeCampusBounds,
  computeCoordsBounds,
  computeRoofLiftPx,
  enrichBuildingsGeoJSON,
  extractBuildings,
  filterContextFor3D,
  getEstimatedBuildingHeightM,
  getMapPadding,
  INITIAL_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  SIDEBAR_MARGIN_TABLET,
  SIDEBAR_WIDTH_DESKTOP,
  SIDEBAR_WIDTH_TABLET,
} from '../lib/geo';
import { createPastelMapStyle } from '../lib/mapStyle';
import {
  headingAhead,
  isOffRoute,
  nextManeuver,
  offsetCoordMeters,
  pointAt,
  prepareRoute,
  remainingM,
  smoothBearing,
  snapToRoute,
  splitRouteGeoJSON,
  type Maneuver,
} from '../lib/navigation';
import { isInsideCampusArea, routeToGeoJSON } from '../lib/routing';
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
import {
  DestinationRoofChip,
  GroundManeuverArrow,
  GroundUserCone,
  NavUserAvatar,
} from './NavGroundMarkers';
import { PlaceMarker } from './PlaceMarker';
import { UserDot } from './UserDot';

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
  triggerDrift40m: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface MapViewProps {
  buildings: Building[];
  breakpoint: Breakpoint;
  onSelectBuilding: (id: string) => void;
  onSelectFriend: (userId: string) => void;
  onBearingChange?: (bearing: number) => void;
  onManeuverChange?: (maneuver: Maneuver | null) => void;
  onToast?: (message: string) => void;
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

function computeFriendRingCoord(
  centroid: LngLat,
  index: number,
  totalInBuilding: number
): LngLat {
  const angle =
    -Math.PI / 4 + (index * 2 * Math.PI) / Math.max(totalInBuilding, 3);
  const radiusLng = 0.00017;
  const radiusLat = 0.00016;
  return [
    centroid[0] + Math.cos(angle) * radiusLng,
    centroid[1] + Math.sin(angle) * radiusLat,
  ];
}

function getNavPadding(bp: Breakpoint): maplibregl.PaddingOptions {
  if (bp === 'desktop') {
    return {
      top: NAV_TOP_PADDING_DESKTOP,
      bottom: NAV_BOTTOM_PADDING_EXTRA + NAV_ROUTE_PANEL_HEIGHT_DESKTOP,
      left: SIDEBAR_WIDTH_DESKTOP,
      right: 0,
    };
  }
  if (bp === 'tablet') {
    return {
      top: NAV_TOP_PADDING_DESKTOP,
      bottom: NAV_BOTTOM_PADDING_EXTRA + NAV_ROUTE_PANEL_HEIGHT_DESKTOP,
      left: SIDEBAR_WIDTH_TABLET + SIDEBAR_MARGIN_TABLET,
      right: 0,
    };
  }
  return {
    top: NAV_TOP_PADDING_MOBILE,
    bottom: NAV_BOTTOM_PADDING_EXTRA + NAV_ROUTE_PANEL_HEIGHT_MOBILE,
    left: 0,
    right: 0,
  };
}

export const campusBuildingsGeoJSON = JSON.parse(
  buildingsRaw
) as BuildingsGeoJSON;
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

const LAYERS_3D_FLAT = ['context-3d', 'buildings-3d'] as const;

const LAYERS_ILL_COMMON = [
  'ill-paving-fill',
  'ill-tree-grass',
  'ill-roads-curb',
] as const;

const LAYERS_ILL_2D = ['ill-shadows-2d', 'ill-tree-canopies-2d'] as const;

const LAYERS_ILL_3D = [
  'ill-shadows-3d',
  'ill-context-3d',
  'ill-context-roofs',
  'ill-building-bands',
  'ill-building-roofs',
  'ill-tree-trunks',
  'ill-tree-canopies-3d',
] as const;

const LAYERS_NAV3D_ROUTE = ['route-done', 'route-glow', 'route-core'] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(
  function MapView(
    {
      buildings,
      breakpoint,
      onSelectBuilding,
      onSelectFriend,
      onBearingChange,
      onManeuverChange,
      onToast,
    },
    ref
  ) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const userMarkerRef = useRef<maplibregl.Marker | null>(null);
    const groundConeMarkerRef = useRef<maplibregl.Marker | null>(null);
    const maneuverMarkerRef = useRef<maplibregl.Marker | null>(null);
    const destChipMarkerRef = useRef<maplibregl.Marker | null>(null);
    const friendMarkersRef = useRef<
      Map<string, { marker: maplibregl.Marker; container: HTMLDivElement }>
    >(new Map());

    const breakpointRef = useRef<Breakpoint>(breakpoint);
    breakpointRef.current = breakpoint;
    const onBearingChangeRef = useRef(onBearingChange);
    onBearingChangeRef.current = onBearingChange;
    const onManeuverChangeRef = useRef(onManeuverChange);
    onManeuverChangeRef.current = onManeuverChange;
    const onToastRef = useRef(onToast);
    onToastRef.current = onToast;

    const [mapReady, setMapReady] = useState(false);
    const [zoom, setZoom] = useState(INITIAL_ZOOM);
    const [pitch, setPitch] = useState(0);
    const [markerPortals, setMarkerPortals] = useState<MarkerPortalEntry[]>([]);
    const [friendPortals, setFriendPortals] = useState<FriendPortalEntry[]>([]);
    const [userDotEl, setUserDotEl] = useState<HTMLDivElement | null>(null);
    const [groundConeEl, setGroundConeEl] = useState<HTMLDivElement | null>(
      null
    );
    const [maneuverEl, setManeuverEl] = useState<HTMLDivElement | null>(null);
    const [destChipEl, setDestChipEl] = useState<HTMLDivElement | null>(null);
    const [navHeading, setNavHeading] = useState(0);
    const [activeManeuver, setActiveManeuver] = useState<Maneuver | null>(null);
    const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(
      null
    );
    const [hiddenLabelIds, setHiddenLabelIds] = useState<Set<string>>(
      () => new Set()
    );

    const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
    const selectedFloor = useAppStore((s) => s.selectedFloor);
    const selectedFriendId = useAppStore((s) => s.selectedFriendId);
    const cameraMode = useAppStore((s) => s.cameraMode);
    const visualStyle = useAppStore((s) => s.visualStyle);
    const followPaused = useAppStore((s) => s.followPaused);
    const positionSource = useAppStore((s) => s.positionSource);
    const simSpeed = useAppStore((s) => s.simSpeed);
    const simPlaying = useAppStore((s) => s.simPlaying);
    const hasArrived = useAppStore((s) => s.hasArrived);
    const userPosition = useAppStore((s) => s.userPosition);
    const route = useAppStore((s) => s.route);
    const routeStatus = useAppStore((s) => s.routeStatus);
    const friends = useAppStore((s) => s.friends);
    const visibleFriendIds = useAppStore((s) => s.visibleFriendIds);
    const myPresence = useAppStore((s) => s.myPresence);

    const clearSelection = useAppStore((s) => s.clearSelection);
    const setFollowPaused = useAppStore((s) => s.setFollowPaused);
    const setDistanceAlongM = useAppStore((s) => s.setDistanceAlongM);
    const setHasArrived = useAppStore((s) => s.setHasArrived);
    const setPositionSource = useAppStore((s) => s.setPositionSource);
    const recomputeRouteFrom = useAppStore((s) => s.recomputeRouteFrom);

    const isNav3D = ENABLE_NAV3D && cameraMode === 'nav3d';
    const is3D = ENABLE_3D && (cameraMode === 'overview3d' || isNav3D);
    const isIllustrated = ENABLE_ILLUSTRATED && visualStyle === 'illustrated';

    const selectedIdRef = useRef<string | null>(selectedBuildingId);
    selectedIdRef.current = selectedBuildingId;
    const is3DRef = useRef(is3D);
    is3DRef.current = is3D;
    const isIllustratedRef = useRef(isIllustrated);
    isIllustratedRef.current = isIllustrated;
    const isNav3DRef = useRef(isNav3D);
    isNav3DRef.current = isNav3D;
    const followPausedRef = useRef(followPaused);
    followPausedRef.current = followPaused;
    const simSpeedRef = useRef(simSpeed);
    simSpeedRef.current = simSpeed;
    const simPlayingRef = useRef(simPlaying);
    simPlayingRef.current = simPlaying;
    const positionSourceRef = useRef(positionSource);
    positionSourceRef.current = positionSource;
    const hasArrivedRef = useRef(hasArrived);
    hasArrivedRef.current = hasArrived;
    const routeStatusRef = useRef(routeStatus);
    routeStatusRef.current = routeStatus;
    const userPositionRef = useRef(userPosition);
    userPositionRef.current = userPosition;

    // Live simulation/navigation refs updated at 30fps without React thrash
    const distAlongRef = useRef(0);
    const currentBearingRef = useRef(0);
    const currentNavPosRef = useRef<LngLat>(userPosition);

    const buildingsById = useMemo(
      () => new Map(buildings.map((b) => [b.id, b])),
      [buildings]
    );

    const preparedRoute = useMemo(
      () => (route ? prepareRoute(route.coords) : null),
      [route]
    );

    const campusBounds = useMemo(
      () => computeCampusBounds(buildings, userPosition),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [buildings]
    );

    const style = useMemo(() => {
      const pathsGraph = pathsData as unknown as PathsGraph;
      const roads = buildRoadsGeoJSON(pathsGraph);
      const contextRaw = Object.values(contextModules)[0];
      const contextGeoJSON = contextRaw
        ? (JSON.parse(contextRaw) as GeoJSON.FeatureCollection)
        : null;
      const context3DGeoJSON = filterContextFor3D(contextGeoJSON);
      const illustrated = ENABLE_ILLUSTRATED
        ? getIllustratedAssets({
            buildings: campusBuildings,
            buildingStyles: buildingStyleData as unknown as BuildingStyleMap,
            context3DGeoJSON,
            paths: pathsGraph,
          })
        : null;

      return createPastelMapStyle({
        buildings: enrichedBuildingsGeoJSON,
        roads,
        contextGeoJSON,
        context3DGeoJSON,
        illustrated,
      });
    }, []);

    // Reset distanceAlong when route changes
    useEffect(() => {
      distAlongRef.current = 0;
      if (preparedRoute && preparedRoute.coords.length >= 2) {
        currentBearingRef.current = headingAhead(preparedRoute, 0, LOOKAHEAD_M);
        currentNavPosRef.current = preparedRoute.coords[0];
      }
    }, [preparedRoute]);

    const recomputeLabelOverlaps = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;

      const selectedId = selectedIdRef.current;
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
        triggerDrift40m() {
          // Dev test: drift 40 m east of current position and recompute route
          const basePos = currentNavPosRef.current ?? userPositionRef.current;
          const drifted = offsetCoordMeters(basePos, 40, 0);
          const ok = recomputeRouteFrom(drifted);
          if (ok) {
            onToastRef.current?.('Recalculating');
          }
        },
        zoomIn() {
          mapRef.current?.zoomIn({ duration: 250 });
        },
        zoomOut() {
          mapRef.current?.zoomOut({ duration: 250 });
        },
      }),
      [buildingsById, fitAll, recomputeRouteFrom]
    );

    // Mount MapLibre instance ONCE
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
        maxPitch: MAX_PITCH,
        scrollZoom: true,
        dragPan: true,
        dragRotate: true,
        touchPitch: true,
        attributionControl: false,
      });

      mapRef.current = map;
      const createdMarkers: maplibregl.Marker[] = [];

      map.on('load', () => {
        map.setLight({
          anchor: 'viewport',
          color: '#ffffff',
          intensity: 0.4,
        });
        setMapReady(true);

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

        // Building centroid markers
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

        // User marker (upright screen-aligned)
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

        // Flat ground cone + pulsing ring marker (pitchAlignment + rotationAlignment "map")
        const coneEl = document.createElement('div');
        const coneMarker = new maplibregl.Marker({
          element: coneEl,
          anchor: 'center',
          pitchAlignment: 'map',
          rotationAlignment: 'map',
        })
          .setLngLat(userPositionRef.current)
          .addTo(map);
        groundConeMarkerRef.current = coneMarker;
        createdMarkers.push(coneMarker);
        setGroundConeEl(coneEl);

        // Flat ground maneuver arrow marker (pitchAlignment + rotationAlignment "map")
        const manEl = document.createElement('div');
        const manMarker = new maplibregl.Marker({
          element: manEl,
          anchor: 'center',
          pitchAlignment: 'map',
          rotationAlignment: 'map',
        })
          .setLngLat(CAMPUS_CENTER)
          .addTo(map);
        maneuverMarkerRef.current = manMarker;
        createdMarkers.push(manMarker);
        setManeuverEl(manEl);

        // Destination roof chip marker (Nav3D only)
        const dEl = document.createElement('div');
        const dMarker = new maplibregl.Marker({
          element: dEl,
          anchor: 'bottom',
        })
          .setLngLat(CAMPUS_CENTER)
          .addTo(map);
        destChipMarkerRef.current = dMarker;
        createdMarkers.push(dMarker);
        setDestChipEl(dEl);

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

      map.on('pitch', syncCameraMetrics);
      map.on('rotate', () => {
        onBearingChangeRef.current?.(map.getBearing());
      });
      map.on('move', syncCameraMetrics);
      map.on('moveend', () => {
        syncCameraMetrics();
        recomputeLabelOverlaps();
      });

      map.on('dragstart', () => {
        if (isNav3DRef.current && !hasArrivedRef.current) {
          setFollowPaused(true);
        }
      });

      map.on('click', (e) => {
        if (isNav3DRef.current) return;
        const queryLayers = is3DRef.current
          ? isIllustratedRef.current
            ? ['ill-building-bands', 'selected-floor-3d', 'buildings-3d']
            : ['buildings-3d', 'buildings-3d-below', 'buildings-3d-above', 'selected-floor-3d']
          : ['buildings-fill'];
        const existingLayers = queryLayers.filter((id) => map.getLayer(id));
        const features = map.queryRenderedFeatures(e.point, {
          layers: existingLayers,
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
        if (!isNav3DRef.current) map.getCanvas().style.cursor = 'pointer';
      };
      const handleMouseLeave = () => {
        map.getCanvas().style.cursor = '';
      };
      map.on('mouseenter', 'buildings-fill', handleMouseEnter);
      map.on('mouseleave', 'buildings-fill', handleMouseLeave);
      map.on('mouseenter', 'buildings-3d', handleMouseEnter);
      map.on('mouseleave', 'buildings-3d', handleMouseLeave);
      if (map.getLayer('ill-building-bands')) {
        map.on('mouseenter', 'ill-building-bands', handleMouseEnter);
        map.on('mouseleave', 'ill-building-bands', handleMouseLeave);
      }

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
        groundConeMarkerRef.current = null;
        maneuverMarkerRef.current = null;
        destChipMarkerRef.current = null;
        map.remove();
        mapRef.current = null;
        setMapReady(false);
        setMarkerPortals([]);
        setFriendPortals([]);
        setUserDotEl(null);
        setGroundConeEl(null);
        setManeuverEl(null);
        setDestChipEl(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [style]);

    // Sync 2D / Overview 3D / Navigation 3D + Flat/Illustrated layer visibility & camera
    const prevCameraModeRef = useRef<string | null>(null);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      const setVis = (id: string, visible: boolean) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      };

      // Ground tint & lighting
      if (map.getLayer('map-background')) {
        map.setPaintProperty(
          'map-background',
          'background-color',
          isIllustrated ? '#EFF3EC' : '#EEF1F0'
        );
      }
      map.setLight({
        anchor: 'viewport',
        color: '#ffffff',
        intensity: isIllustrated ? 0.45 : 0.4,
      });

      // Soft atmosphere sky (MapLibre v5+)
      const skyMap = map as unknown as {
        setSky?: (sky: Record<string, unknown> | undefined) => void;
      };
      if (typeof skyMap.setSky === 'function') {
        if (isIllustrated && is3D) {
          skyMap.setSky({
            'sky-color': '#C5F1E1',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#F5FAF8',
            'horizon-fog-blend': 0.6,
            'fog-color': '#EFF3EC',
            'fog-ground-blend': 0.7,
          });
        } else {
          skyMap.setSky(undefined);
        }
      }

      // 2D flat layers
      for (const layerId of LAYERS_2D) {
        setVis(layerId, !is3D);
      }

      // Flat 3D extrusion layers (shown only in Flat 3D)
      for (const layerId of LAYERS_3D_FLAT) {
        setVis(layerId, is3D && !isIllustrated);
      }

      // Illustrated decorative layers
      for (const layerId of LAYERS_ILL_COMMON) {
        setVis(layerId, isIllustrated);
      }
      for (const layerId of LAYERS_ILL_2D) {
        setVis(layerId, isIllustrated && !is3D);
      }
      for (const layerId of LAYERS_ILL_3D) {
        setVis(layerId, isIllustrated && is3D);
      }

      // Selected floor slab in Overview 3D
      setVis('selected-floor-3d', is3D && !isNav3D);

      // Selected building base glow in Illustrated 3D (no overlapping wall extrusion!)
      const showIllSelected =
        isIllustrated && is3D && !isNav3D && Boolean(selectedBuildingId);
      setVis('ill-building-selected-glow', showIllSelected);
      if (map.getLayer('ill-building-selected-glow')) {
        map.setFilter('ill-building-selected-glow', [
          '==',
          ['get', 'id'],
          showIllSelected ? selectedBuildingId ?? '' : '',
        ]);
      }

      // Flat 3D split below/above layers for non-overlapping selected floor
      const showFlatSelectedSplit =
        !isIllustrated && is3D && !isNav3D && Boolean(selectedBuildingId);
      setVis('buildings-3d-below', showFlatSelectedSplit);
      setVis('buildings-3d-above', showFlatSelectedSplit);

      // Navigation 3D solid glowing route vs 2D/Overview dotted route
      for (const layerId of LAYERS_NAV3D_ROUTE) {
        setVis(layerId, isNav3D);
      }
      setVis('route-line-regular', !isNav3D);
      if (map.getLayer('route-casing')) {
        map.setPaintProperty('route-casing', 'line-width', isNav3D ? 10 : 9);
      }

      // Destination building highlight in Nav3D
      const destFilter: maplibregl.FilterSpecification = [
        '==',
        ['get', 'id'],
        isNav3D && selectedBuildingId ? selectedBuildingId : '',
      ];
      setVis('nav-dest-building-3d', isNav3D && Boolean(selectedBuildingId));
      setVis('nav-dest-edge-3d', isNav3D && Boolean(selectedBuildingId));
      if (map.getLayer('nav-dest-building-3d')) {
        map.setFilter('nav-dest-building-3d', destFilter);
      }
      if (map.getLayer('nav-dest-edge-3d')) {
        map.setFilter('nav-dest-edge-3d', destFilter);
      }

      // Position destination roof chip at destination building centroid
      if (isNav3D && selectedBuildingId) {
        const destB = buildingsById.get(selectedBuildingId);
        if (destB) {
          destChipMarkerRef.current?.setLngLat(destB.centroid);
        }
      }

      // Animate camera when switching between 2d and overview3d
      if (prevCameraModeRef.current !== cameraMode) {
        const wasNull = prevCameraModeRef.current === null;
        prevCameraModeRef.current = cameraMode;

        if (!wasNull && cameraMode === '2d') {
          if (route && route.coords.length >= 2) {
            const padding = getMapPadding(breakpointRef.current, true);
            map.fitBounds(computeCoordsBounds(route.coords), {
              padding,
              maxZoom: 18.5,
              pitch: 0,
              bearing: 0,
              duration: prefersReducedMotion() ? 0 : 700,
            });
          } else {
            map.easeTo({
              pitch: 0,
              bearing: 0,
              padding: getMapPadding(
                breakpointRef.current,
                Boolean(selectedIdRef.current)
              ),
              duration: prefersReducedMotion() ? 0 : 700,
            });
          }
        } else if (!wasNull && cameraMode === 'overview3d') {
          if (route && route.coords.length >= 2) {
            const padding = getMapPadding(breakpointRef.current, true);
            map.fitBounds(computeCoordsBounds(route.coords), {
              padding,
              maxZoom: 18.5,
              pitch: OVERVIEW_3D_ROUTE_PITCH,
              bearing: OVERVIEW_3D_BEARING,
              duration: prefersReducedMotion() ? 0 : 700,
            });
          } else {
            map.easeTo({
              pitch: OVERVIEW_3D_PITCH,
              bearing: OVERVIEW_3D_BEARING,
              padding: getMapPadding(
                breakpointRef.current,
                Boolean(selectedIdRef.current)
              ),
              duration: prefersReducedMotion() ? 0 : 700,
            });
          }
        }
      }
    }, [
      cameraMode,
      is3D,
      isNav3D,
      isIllustrated,
      selectedBuildingId,
      mapReady,
      route,
      buildingsById,
    ]);

    // Sync selected building highlight (2D) + non-overlapping red floor slab (3D)
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

      const isBasement = /^b/i.test(selectedFloor);
      const floorNum = isBasement
        ? 1
        : Math.max(1, Number.parseInt(selectedFloor, 10) || 1);
      const baseM = isBasement ? 0 : (floorNum - 1) * FLOOR_HEIGHT_M;
      const heightM = isBasement ? 1.8 : floorNum * FLOOR_HEIGHT_M;

      // Prevent ANY coplanar z-fighting between ill-building-bands and selected-floor-3d / nav-dest-building-3d
      if (map.getLayer('ill-building-bands')) {
        if (isNav3D && selectedBuildingId) {
          // Exclude destination building completely so nav-dest-building-3d draws cleanly
          map.setFilter('ill-building-bands', [
            '!=',
            ['get', 'id'],
            selectedBuildingId,
          ]);
        } else if (is3D && isIllustrated && selectedBuildingId) {
          // Cut out ONLY the selected floor from the selected building so red selected-floor-3d sits cleanly in that slot
          map.setFilter('ill-building-bands', [
            'any',
            ['!=', ['get', 'id'], selectedBuildingId],
            ['!=', ['get', 'floor'], floorNum],
          ]);
        } else {
          map.setFilter('ill-building-bands', null);
        }
      }

      // Prevent coplanar z-fighting in Flat 3D as well
      if (map.getLayer('buildings-3d')) {
        if (is3D && !isIllustrated && selectedBuildingId) {
          map.setFilter('buildings-3d', [
            '!=',
            ['get', 'id'],
            selectedBuildingId,
          ]);
        } else {
          map.setFilter('buildings-3d', null);
        }
      }

      if (map.getLayer('buildings-3d-below')) {
        map.setFilter('buildings-3d-below', [
          '==',
          ['get', 'id'],
          is3D && !isIllustrated && !isNav3D && selectedBuildingId && baseM > 0
            ? selectedBuildingId
            : '',
        ]);
        map.setPaintProperty('buildings-3d-below', 'fill-extrusion-height', baseM);
      }

      if (map.getLayer('buildings-3d-above')) {
        const b = selectedBuildingId
          ? buildingsById.get(selectedBuildingId)
          : null;
        const totalH = b ? getEstimatedBuildingHeightM(b) : heightM;
        map.setFilter('buildings-3d-above', [
          '==',
          ['get', 'id'],
          is3D &&
          !isIllustrated &&
          !isNav3D &&
          selectedBuildingId &&
          totalH > heightM
            ? selectedBuildingId
            : '',
        ]);
        map.setPaintProperty(
          'buildings-3d-above',
          'fill-extrusion-base',
          heightM
        );
      }

      if (map.getLayer('selected-floor-3d')) {
        map.setFilter('selected-floor-3d', [
          '==',
          ['get', 'id'],
          is3D && !isNav3D && selectedBuildingId ? selectedBuildingId : '',
        ]);

        if (selectedBuildingId) {
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
    }, [
      selectedBuildingId,
      selectedFloor,
      is3D,
      isNav3D,
      isIllustrated,
      mapReady,
      buildingsById,
      recomputeLabelOverlaps,
    ]);

    // Sync userPosition onto UserDot marker when NOT in Nav3D
    useEffect(() => {
      if (isNav3D) return;
      userMarkerRef.current?.setLngLat(userPosition);
      groundConeMarkerRef.current?.setLngLat(userPosition);
    }, [userPosition, isNav3D]);

    // Sync FriendPin markers (hidden in Navigation 3D, visible in 2D & Overview 3D)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      if (isNav3D) {
        friendMarkersRef.current.forEach(({ marker }) => marker.remove());
        friendMarkersRef.current.clear();
        setFriendPortals([]);
        return;
      }

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

      const groupedByBuilding = new Map<string, FriendRecord[]>();
      for (const f of visibleFriends) {
        const bId = f.presence.buildingId;
        if (!bId) continue;
        const list = groupedByBuilding.get(bId) ?? [];
        list.push(f);
        groupedByBuilding.set(bId, list);
      }

      const activeIds = new Set(visibleFriends.map((f) => f.user.id));
      for (const [id, entry] of friendMarkersRef.current.entries()) {
        if (!activeIds.has(id)) {
          entry.marker.remove();
          friendMarkersRef.current.delete(id);
        }
      }

      const reduced = prefersReducedMotion();
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

            if (moved && !reduced) {
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
                if (t < 1) rafIds.push(requestAnimationFrame(step));
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
    }, [friends, visibleFriendIds, mapReady, buildingsById, isNav3D]);

    // Sync route GeoJSON in 2D / Overview 3D (and clear when route ends)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      const routeSource = map.getSource('route') as
        | maplibregl.GeoJSONSource
        | undefined;
      const doneSource = map.getSource('route-done') as
        | maplibregl.GeoJSONSource
        | undefined;
      const entranceSource = map.getSource('route-entrance') as
        | maplibregl.GeoJSONSource
        | undefined;

      if (!route) {
        routeSource?.setData({ type: 'FeatureCollection', features: [] });
        doneSource?.setData({ type: 'FeatureCollection', features: [] });
        entranceSource?.setData({ type: 'FeatureCollection', features: [] });
        setActiveManeuver(null);
        onManeuverChangeRef.current?.(null);
        return;
      }

      if (route.destinationEntrance) {
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
      }

      if (!isNav3D) {
        routeSource?.setData(routeToGeoJSON(route));
        doneSource?.setData({ type: 'FeatureCollection', features: [] });
        if (route.coords.length >= 2) {
          const padding = getMapPadding(breakpointRef.current, true);
          map.fitBounds(computeCoordsBounds(route.coords), {
            padding,
            maxZoom: 18.5,
            pitch: is3DRef.current ? OVERVIEW_3D_ROUTE_PITCH : 0,
            duration: prefersReducedMotion() ? 0 : 550,
          });
        }
      }
    }, [route, isNav3D, mapReady]);

    // Navigation 3D 30fps requestAnimationFrame follow camera & simulated walk loop
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady || !isNav3D || !route || !preparedRoute) {
        return;
      }

      let rafId = 0;
      let lastFrameTs = performance.now();
      let lastRouteSyncTs = 0;
      const reduced = prefersReducedMotion();

      const updateNavFrame = (now: number) => {
        rafId = requestAnimationFrame(updateNavFrame);

        const elapsed = now - lastFrameTs;
        if (elapsed < NAV_FRAME_INTERVAL_MS) return;
        const dtSec = Math.min(0.2, elapsed / 1000);
        lastFrameTs = now;

        // Advance simulated walk along route
        if (
          positionSourceRef.current === 'sim' &&
          simPlayingRef.current &&
          !hasArrivedRef.current
        ) {
          distAlongRef.current = Math.min(
            preparedRoute.totalMeters,
            distAlongRef.current + SIM_WALK_SPEED_MPS * simSpeedRef.current * dtSec
          );
        }

        const dist = distAlongRef.current;
        const pos = pointAt(preparedRoute, dist);
        currentNavPosRef.current = pos;

        const targetHeading = headingAhead(preparedRoute, dist, LOOKAHEAD_M);
        const smoothedHeading = reduced
          ? targetHeading
          : smoothBearing(
              currentBearingRef.current,
              targetHeading,
              BEARING_SMOOTHING
            );
        currentBearingRef.current = smoothedHeading;

        // Update user avatar + flat ground cone
        userMarkerRef.current?.setLngLat(pos);
        groundConeMarkerRef.current?.setLngLat(pos);

        // Follow camera with jumpTo (no stacked easeTo calls)
        if (!followPausedRef.current && !hasArrivedRef.current) {
          map.jumpTo({
            center: pos,
            zoom: NAV_ZOOM,
            pitch: NAV_PITCH,
            bearing: smoothedHeading,
            padding: getNavPadding(breakpointRef.current),
          });
        }

        // Throttle route split + React UI updates to at most every 200 ms
        if (now - lastRouteSyncTs >= NAV_ROUTE_UPDATE_INTERVAL_MS) {
          lastRouteSyncTs = now;

          const { done, remaining } = splitRouteGeoJSON(route, dist);
          (
            map.getSource('route-done') as maplibregl.GeoJSONSource | undefined
          )?.setData(done);
          (
            map.getSource('route') as maplibregl.GeoJSONSource | undefined
          )?.setData(remaining);

          const maneuver = nextManeuver(preparedRoute, dist);
          const arrowCoord =
            maneuver.type === 'straight'
              ? pointAt(preparedRoute, dist + 20)
              : maneuver.coord;
          maneuverMarkerRef.current?.setLngLat(arrowCoord);

          setNavHeading(smoothedHeading);
          setActiveManeuver(maneuver);
          onManeuverChangeRef.current?.(maneuver);
          setDistanceAlongM(dist);

          // Arrival check (<= 12 m remaining)
          if (
            !hasArrivedRef.current &&
            remainingM(preparedRoute, dist) <= ARRIVAL_THRESHOLD_M
          ) {
            setHasArrived(true);
          }
        }
      };

      // Trigger immediate initial frame
      lastRouteSyncTs = 0;
      rafId = requestAnimationFrame(updateNavFrame);

      return () => {
        cancelAnimationFrame(rafId);
      };
    }, [
      isNav3D,
      mapReady,
      route,
      preparedRoute,
      setDistanceAlongM,
      setHasArrived,
    ]);

    // Real GPS watchPosition in Navigation 3D when positionSource === 'gps'
    useEffect(() => {
      if (!isNav3D || positionSource !== 'gps' || !preparedRoute) return;

      if (!navigator.geolocation) {
        setPositionSource('sim');
        onToastRef.current?.('Location is off. Using a demo start point.');
        return;
      }

      const recentFixes: LngLat[] = [];
      let offRouteStreak = 0;

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos.coords.accuracy > GPS_MAX_ACCURACY_M) return;

          const raw: LngLat = [pos.coords.longitude, pos.coords.latitude];
          if (
            !isInsideCampusArea(raw, buildings, CAMPUS_GEOLOCATION_MARGIN_M)
          ) {
            setPositionSource('sim');
            onToastRef.current?.(
              'You are outside the campus. Using a demo start point.'
            );
            return;
          }

          recentFixes.push(raw);
          if (recentFixes.length > GPS_SMOOTHING_WINDOW) {
            recentFixes.shift();
          }

          const avgLng =
            recentFixes.reduce((s, c) => s + c[0], 0) / recentFixes.length;
          const avgLat =
            recentFixes.reduce((s, c) => s + c[1], 0) / recentFixes.length;
          const smoothed: LngLat = [avgLng, avgLat];

          const snap = snapToRoute(preparedRoute, smoothed);
          if (isOffRoute(snap.offsetM)) {
            offRouteStreak += 1;
            if (offRouteStreak >= OFF_ROUTE_CONSECUTIVE_FIXES) {
              offRouteStreak = 0;
              const ok = recomputeRouteFrom(smoothed);
              if (ok) {
                onToastRef.current?.('Recalculating');
              }
            }
          } else {
            offRouteStreak = 0;
            distAlongRef.current = snap.distanceAlongM;
          }
        },
        () => {
          setPositionSource('sim');
          onToastRef.current?.('Location is off. Using a demo start point.');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }, [
      isNav3D,
      positionSource,
      preparedRoute,
      buildings,
      setPositionSource,
      recomputeRouteFrom,
    ]);

    // Re-apply responsive padding & resize whenever breakpoint changes
    const prevBreakpointRef = useRef<Breakpoint>(breakpoint);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      if (prevBreakpointRef.current === breakpoint) return;
      prevBreakpointRef.current = breakpoint;

      map.resize();
      if (isNav3D) return; // Nav3D loop uses breakpointRef automatically

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
      isNav3D,
      selectedBuildingId,
      route,
      buildingsById,
      campusBounds,
    ]);

    const showLabels = zoom >= 16.5;
    const destBuilding = selectedBuildingId
      ? buildingsById.get(selectedBuildingId) ?? null
      : null;

    return (
      <div className="relative h-full w-full">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Horizon haze gradient overlay in Navigation 3D (160px, #C5F1E1 -> transparent) */}
        {isNav3D && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[160px]"
            style={{
              background:
                'linear-gradient(to bottom, #C5F1E1 0%, rgba(197, 241, 225, 0) 100%)',
            }}
          />
        )}

        {/* Building PlaceMarker portals (hidden in Navigation 3D) */}
        {!isNav3D &&
          markerPortals.map(({ id, building, container }) => {
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
                  is3D
                    ? false
                    : hiddenLabelIds.has(id) && hoveredBuildingId !== id
                }
                liftOffsetPx={liftOffsetPx}
                onSelect={onSelectBuilding}
                onHoverChange={setHoveredBuildingId}
              />,
              container
            );
          })}

        {/* Destination roof chip in Navigation 3D */}
        {isNav3D &&
          destChipEl &&
          destBuilding &&
          createPortal(
            <DestinationRoofChip
              building={destBuilding}
              selectedFloor={selectedFloor}
              liftOffsetPx={computeRoofLiftPx(
                getEstimatedBuildingHeightM(destBuilding),
                destBuilding.centroid[1],
                zoom,
                pitch
              )}
            />,
            destChipEl
          )}

        {/* Visible FriendPin portals (hidden in Navigation 3D) */}
        {!isNav3D &&
          friendPortals.map(({ userId, friend, container }) =>
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

        {/* Flat ground cone + pulsing ring (Navigation 3D only) */}
        {isNav3D &&
          groundConeEl &&
          createPortal(<GroundUserCone headingDeg={navHeading} />, groundConeEl)}

        {/* Flat ground maneuver arrow + distance bubble (Navigation 3D only while walking) */}
        {isNav3D &&
          !hasArrived &&
          maneuverEl &&
          activeManeuver &&
          createPortal(
            <GroundManeuverArrow
              headingDeg={activeManeuver.headingAfter}
              distanceM={activeManeuver.distanceToM}
            />,
            maneuverEl
          )}

        {/* Upright user marker: NavUserAvatar in Nav3D, UserDot in 2D/Overview 3D */}
        {userDotEl &&
          createPortal(
            isNav3D ? (
              <NavUserAvatar />
            ) : (
              <UserDot
                status={myPresence.status}
                showStatusBubble={myPresence.shareOn && !myPresence.ghost}
              />
            ),
            userDotEl
          )}
      </div>
    );
  }
);

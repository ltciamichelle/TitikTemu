import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import buildingsRaw from '../../data/buildings.geojson?raw';
import pathsData from '../../data/paths.json';
import {
  buildRoadsGeoJSON,
  CAMPUS_CENTER,
  computeCampusBounds,
  DEMO_USER_POSITION,
  INITIAL_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
} from '../../lib/geo';
import { createPastelMapStyle } from '../../lib/mapStyle';
import type { Building, BuildingsGeoJSON, LngLat, PathsGraph } from '../../types';

interface AdminMapProps {
  buildings: Building[];
  selectedBuildingId: string;
  entranceOverride: LngLat | null;
  isPickingEntrance: boolean;
  onSelectBuilding: (id: string) => void;
  onPickEntrance: (coord: LngLat) => void;
}

const geojson = JSON.parse(buildingsRaw) as BuildingsGeoJSON;
const paths = pathsData as unknown as PathsGraph;

export function AdminMap({
  buildings,
  selectedBuildingId,
  entranceOverride,
  isPickingEntrance,
  onSelectBuilding,
  onPickEntrance,
}: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const isPickingRef = useRef(isPickingEntrance);
  isPickingRef.current = isPickingEntrance;
  const onPickRef = useRef(onPickEntrance);
  onPickRef.current = onPickEntrance;
  const onSelectRef = useRef(onSelectBuilding);
  onSelectRef.current = onSelectBuilding;

  const buildingsById = useMemo(
    () => new Map(buildings.map((b) => [b.id, b])),
    [buildings]
  );

  const style = useMemo(() => {
    const roads = buildRoadsGeoJSON(paths);
    return createPastelMapStyle({
      buildings: geojson as unknown as GeoJSON.FeatureCollection,
      roads,
      contextGeoJSON: null,
      context3DGeoJSON: null,
      illustrated: null,
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = new maplibregl.Map({
      container: el,
      style,
      center: CAMPUS_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      setMapReady(true);
      const bounds = computeCampusBounds(buildings, DEMO_USER_POSITION);
      map.fitBounds(bounds, { padding: 48, maxZoom: 18, duration: 0 });
    });

    map.on('click', (e) => {
      if (isPickingRef.current) {
        const lng = Number(e.lngLat.lng.toFixed(7));
        const lat = Number(e.lngLat.lat.toFixed(7));
        onPickRef.current([lng, lat]);
        return;
      }

      const features = map.queryRenderedFeatures(e.point, {
        layers: ['buildings-fill'],
      });
      if (features.length > 0) {
        const id = features[0].properties?.id as string | undefined;
        if (id) onSelectRef.current(id);
      }
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  // Cursor feedback when picking entrance
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.getCanvas().style.cursor = isPickingEntrance ? 'crosshair' : '';
  }, [isPickingEntrance, mapReady]);

  // Highlight selected building & fly to it
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    map.setFilter('buildings-selected-fill', [
      '==',
      ['get', 'id'],
      selectedBuildingId,
    ]);
    map.setFilter('buildings-selected-edge', [
      '==',
      ['get', 'id'],
      selectedBuildingId,
    ]);

    const b = buildingsById.get(selectedBuildingId);
    if (b) {
      map.easeTo({
        center: b.centroid,
        zoom: Math.max(map.getZoom(), 17.8),
        duration: 450,
      });
    }
  }, [selectedBuildingId, buildingsById, mapReady]);

  // Show active entrance dot (entranceOverride if set, else default entrance)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const b = buildingsById.get(selectedBuildingId);
    const coord = entranceOverride ?? b?.entrance ?? null;
    const src = map.getSource('route-entrance') as
      | maplibregl.GeoJSONSource
      | undefined;

    if (coord) {
      src?.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: coord },
          },
        ],
      });
    } else {
      src?.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [selectedBuildingId, entranceOverride, buildingsById, mapReady]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {isPickingEntrance && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
          <span className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white shadow-soft">
            Click anywhere on the map to set entrance coordinates
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-muted shadow-soft-sm">
        © OpenStreetMap contributors
      </div>
    </div>
  );
}

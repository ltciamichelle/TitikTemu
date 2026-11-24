import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBreakpoint } from '../hooks/useMediaQuery';
import {
  CAMPUS_GEOLOCATION_MARGIN_M,
  DEMO_USER_POSITION,
} from '../lib/constants';
import { isInsideCampusArea } from '../lib/routing';
import { useAppStore } from '../store/useAppStore';
import type { LngLat } from '../types';
import { BottomTabBar } from './BottomTabBar';
import { BuildingCard } from './BuildingCard';
import { FriendsPanel } from './FriendsPanel';
import { MapControls } from './MapControls';
import {
  campusBuildings,
  MapView,
  type MapViewHandle,
} from './MapView';
import { RoutePanel } from './RoutePanel';
import { SearchBar } from './SearchBar';
import { Sidebar } from './Sidebar';

export function Layout() {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';

  const activeTab = useAppStore((s) => s.activeTab);
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const route = useAppStore((s) => s.route);
  const routeStatus = useAppStore((s) => s.routeStatus);
  const selectBuilding = useAppStore((s) => s.selectBuilding);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const setUserPosition = useAppStore((s) => s.setUserPosition);
  const startRoute = useAppStore((s) => s.startRoute);
  const endRoute = useAppStore((s) => s.endRoute);

  const mapRef = useRef<MapViewHandle>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedBuilding = useMemo(
    () => campusBuildings.find((b) => b.id === selectedBuildingId) ?? null,
    [selectedBuildingId]
  );

  const handleSelectBuilding = useCallback(
    (id: string, initialFloor = '1') => {
      selectBuilding(id, initialFloor);
      mapRef.current?.flyToBuilding(id);
    },
    [selectBuilding]
  );

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setUserPosition(DEMO_USER_POSITION);
      setToast('Location is off. Using a demo start point.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: LngLat = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        if (
          isInsideCampusArea(
            coords,
            campusBuildings,
            CAMPUS_GEOLOCATION_MARGIN_M
          )
        ) {
          setUserPosition(coords);
          if (routeStatus === 'active' && selectedBuildingId) {
            startRoute(selectedBuildingId);
          } else {
            mapRef.current?.flyToCoord(coords);
          }
        } else {
          setUserPosition(DEMO_USER_POSITION);
          setToast('You are outside the campus. Using a demo start point.');
        }
      },
      () => {
        setUserPosition(DEMO_USER_POSITION);
        setToast('Location is off. Using a demo start point.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  }, [routeStatus, selectedBuildingId, setUserPosition, startRoute]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-map-base">
      {/* Single shared MapView mounted edge-to-edge */}
      <div
        className={`absolute inset-0 ${
          isMobile && activeTab === 'friends' ? 'hidden' : 'block'
        }`}
      >
        <MapView
          ref={mapRef}
          buildings={campusBuildings}
          breakpoint={breakpoint}
          onSelectBuilding={handleSelectBuilding}
        />
      </div>

      {/* Tablet (768-1023px) & Desktop (>=1024px): Shared Sidebar */}
      {!isMobile && (
        <Sidebar
          buildings={campusBuildings}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={handleSelectBuilding}
          onClearSelection={clearSelection}
          mode={breakpoint === 'desktop' ? 'docked' : 'floating'}
        />
      )}

      {/* Mobile (<768px): Floating SearchBar on top (Map tab only) */}
      {isMobile && activeTab === 'map' && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-4"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
        >
          <SearchBar
            buildings={campusBuildings}
            onPickBuilding={handleSelectBuilding}
            mode="floating"
          />
        </div>
      )}

      {/* Mobile (<768px): Friends full-screen panel */}
      {isMobile && activeTab === 'friends' && (
        <div className="absolute inset-0 z-10">
          <FriendsPanel variant="mobile" />
        </div>
      )}

      {/* Locate stub toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none fixed top-5 z-30 flex justify-center px-4 ${
            breakpoint === 'desktop'
              ? 'left-[400px] right-0'
              : breakpoint === 'tablet'
                ? 'left-[356px] right-0'
                : 'inset-x-0 top-[76px]'
          }`}
        >
          <div className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-soft md:text-sm">
            {toast}
          </div>
        </div>
      )}

      {/* Right-side MapControls + Attribution chip cleanly stacked below controls */}
      {(!isMobile || activeTab === 'map') && (
        <div
          className={`pointer-events-none absolute right-4 z-10 flex flex-col items-end gap-2 transition-all duration-200 ${
            isMobile
              ? selectedBuilding
                ? 'bottom-[256px]'
                : 'bottom-[96px]'
              : 'bottom-4'
          }`}
        >
          <MapControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onLocate={handleLocate}
          />
          <div className="pointer-events-auto rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-muted shadow-soft-sm backdrop-blur-[2px]">
            © OpenStreetMap contributors
          </div>
        </div>
      )}

      {/* Mobile (<768px): Bottom Sheet for selected building or active route */}
      {isMobile && activeTab === 'map' && selectedBuilding && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[76px] z-20">
          {routeStatus !== 'idle' ? (
            <RoutePanel
              building={selectedBuilding}
              route={route}
              routeStatus={routeStatus}
              onBackToBuilding={endRoute}
              onEndRoute={() => {
                endRoute();
                clearSelection();
              }}
              variant="sheet"
            />
          ) : (
            <BuildingCard
              building={selectedBuilding}
              onClose={clearSelection}
              variant="sheet"
            />
          )}
        </div>
      )}

      {/* Mobile (<768px): Floating BottomTabBar */}
      {isMobile && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <BottomTabBar />
        </div>
      )}
    </div>
  );
}

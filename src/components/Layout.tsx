import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { useBreakpoint } from '../hooks/useMediaQuery';
import {
  CAMPUS_GEOLOCATION_MARGIN_M,
  DEMO_USER_POSITION,
  ENABLE_3D,
} from '../lib/constants';
import {
  detectNearestBuildingId,
  isDemoMode,
} from '../lib/friendsRepo';
import { isInsideCampusArea } from '../lib/routing';
import { useAppStore } from '../store/useAppStore';
import type { LngLat } from '../types';
import { BottomTabBar } from './BottomTabBar';
import { BuildingCard } from './BuildingCard';
import { FriendCard } from './FriendCard';
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
import { VerticalFloorControl } from './VerticalFloorControl';
import { ViewModeToggle } from './ViewModeToggle';

export function Layout() {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';

  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);
  const mapMode = useAppStore((s) => s.mapMode);
  const setMapMode = useAppStore((s) => s.setMapMode);
  const is3D = ENABLE_3D && mapMode === '3d';
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const selectedFriendId = useAppStore((s) => s.selectedFriendId);
  const friends = useAppStore((s) => s.friends);
  const userPosition = useAppStore((s) => s.userPosition);
  const manualBuildingOverride = useAppStore((s) => s.manualBuildingOverride);
  const route = useAppStore((s) => s.route);
  const routeStatus = useAppStore((s) => s.routeStatus);
  const selectBuilding = useAppStore((s) => s.selectBuilding);
  const selectFriend = useAppStore((s) => s.selectFriend);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const setUserPosition = useAppStore((s) => s.setUserPosition);
  const setMyBuilding = useAppStore((s) => s.setMyBuilding);
  const startRoute = useAppStore((s) => s.startRoute);
  const endRoute = useAppStore((s) => s.endRoute);
  const checkAutoStop = useAppStore((s) => s.checkAutoStop);
  const moveDemoFriend = useAppStore((s) => s.moveDemoFriend);

  const mapRef = useRef<MapViewHandle>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0);

  const selectedBuilding = useMemo(
    () => campusBuildings.find((b) => b.id === selectedBuildingId) ?? null,
    [selectedBuildingId]
  );

  const selectedFriend = useMemo(
    () => friends.find((f) => f.user.id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );

  const selectedFriendBuilding = useMemo(() => {
    const bId = selectedFriend?.presence.buildingId;
    return bId ? campusBuildings.find((b) => b.id === bId) ?? null : null;
  }, [selectedFriend]);

  // Detect nearest building within 60 m whenever userPosition changes (unless manually overridden)
  useEffect(() => {
    if (manualBuildingOverride) return;
    const nearestId = detectNearestBuildingId(userPosition, campusBuildings);
    setMyBuilding(nearestId, false);
  }, [userPosition, manualBuildingOverride, setMyBuilding]);

  // Auto-stop timer: checks every second so 60s (?demo=1) or 2h expiry stops sharing automatically
  useEffect(() => {
    const interval = window.setInterval(() => {
      const stopped = checkAutoStop(Date.now());
      if (stopped) {
        setToast('Sharing stopped automatically');
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [checkAutoStop]);

  // Optional demo mode (?demo=1): every 20 seconds move one visible friend to another building
  useEffect(() => {
    if (!isDemoMode()) return;
    const buildingIds = campusBuildings.map((b) => b.id);
    const interval = window.setInterval(() => {
      moveDemoFriend(buildingIds);
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [moveDemoFriend]);

  const handleSelectBuilding = useCallback(
    (id: string, initialFloor = '1') => {
      selectBuilding(id, initialFloor);
      mapRef.current?.flyToBuilding(id);
    },
    [selectBuilding]
  );

  const handleSelectFriend = useCallback(
    (userId: string) => {
      const target = friends.find((f) => f.user.id === userId);
      setTab('map');
      selectFriend(userId);
      if (target?.presence.buildingId) {
        mapRef.current?.flyToBuilding(target.presence.buildingId);
      }
    },
    [friends, selectFriend, setTab]
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
          onSelectFriend={handleSelectFriend}
          onBearingChange={setBearing}
        />
      </div>

      {/* Tablet (768-1023px) & Desktop (>=1024px): Shared Sidebar */}
      {!isMobile && (
        <Sidebar
          buildings={campusBuildings}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={handleSelectBuilding}
          onFocusFriend={handleSelectFriend}
          onClearSelection={clearSelection}
          mode={breakpoint === 'desktop' ? 'docked' : 'floating'}
        />
      )}

      {/* Mobile (<768px): Floating SearchBar + top-right 2D/3D toggle (Map tab only) */}
      {isMobile && activeTab === 'map' && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2.5 pt-4"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
        >
          <SearchBar
            buildings={campusBuildings}
            onPickBuilding={handleSelectBuilding}
            mode="floating"
          />
          <div className="flex justify-end px-4">
            <ViewModeToggle align="right" />
          </div>
        </div>
      )}

      {/* Mobile (<768px): Friends full-screen panel */}
      {isMobile && activeTab === 'friends' && (
        <div className="absolute inset-0 z-10">
          <FriendsPanel
            buildings={campusBuildings}
            onFocusFriend={handleSelectFriend}
            variant="mobile"
          />
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

      {/* Right-side MapControls, 3D floor picker / Top view, 2D/3D toggle (desktop), and Attribution */}
      {(!isMobile || activeTab === 'map') && (
        <div
          className={`pointer-events-none absolute right-4 z-10 flex flex-col items-end gap-2.5 transition-all duration-200 ${
            isMobile
              ? selectedBuilding || selectedFriend
                ? 'bottom-[256px]'
                : 'bottom-[96px]'
              : 'bottom-4'
          }`}
        >
          {/* Floating vertical floor control in 3D when a multi-floor building is selected */}
          {is3D && selectedBuilding && routeStatus === 'idle' && (
            <VerticalFloorControl building={selectedBuilding} />
          )}

          {/* "Top view" quick switch when routing in 3D */}
          {is3D && routeStatus === 'active' && (
            <button
              type="button"
              onClick={() => setMapMode('2d')}
              className="pointer-events-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-bold text-ink shadow-soft transition-colors hover:bg-mint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-sm"
            >
              <Eye size={16} strokeWidth={1.8} className="text-primary" />
              <span>Top view</span>
            </button>
          )}

          <MapControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onLocate={handleLocate}
            bearing={bearing}
            onResetNorth={() => mapRef.current?.resetNorth()}
          />

          {/* Desktop/Tablet 2D/3D toggle below zoom controls */}
          {!isMobile && <ViewModeToggle align="right" />}

          <div className="pointer-events-auto rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-muted shadow-soft-sm backdrop-blur-[2px]">
            © OpenStreetMap contributors
          </div>
        </div>
      )}

      {/* Mobile (<768px): Bottom Sheet for selected friend, building, or active route */}
      {isMobile && activeTab === 'map' && (selectedFriend || selectedBuilding) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[76px] z-20">
          {selectedFriend ? (
            <FriendCard
              friend={selectedFriend}
              building={selectedFriendBuilding}
              onRouteToBuilding={(buildingId) => startRoute(buildingId)}
              onClose={clearSelection}
              variant="sheet"
            />
          ) : selectedBuilding && routeStatus !== 'idle' ? (
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
          ) : selectedBuilding ? (
            <BuildingCard
              building={selectedBuilding}
              onClose={clearSelection}
              variant="sheet"
            />
          ) : null}
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

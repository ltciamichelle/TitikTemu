import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Eye } from 'lucide-react';
import { useBreakpoint } from '../hooks/useMediaQuery';
import {
  CAMPUS_GEOLOCATION_MARGIN_M,
  DEMO_USER_POSITION,
  ENABLE_3D,
  ENABLE_ILLUSTRATED,
  ENABLE_NAV3D,
  SHOW_DEV_TOOLS,
} from '../lib/constants';
import { detectNearestBuildingId, isDemoMode } from '../lib/friendsRepo';
import type { Maneuver } from '../lib/navigation';
import { isInsideCampusArea } from '../lib/routing';
import { useAppStore } from '../store/useAppStore';
import type { LngLat } from '../types';
import { ArrivalCard } from './ArrivalCard';
import { BottomTabBar } from './BottomTabBar';
import { BuildingCard } from './BuildingCard';
import { FriendCard } from './FriendCard';
import { FriendsPanel } from './FriendsPanel';
import { MapControls } from './MapControls';
import { campusBuildings, MapView, type MapViewHandle } from './MapView';
import { NavBanner } from './NavBanner';
import { PlaceCardsCarousel } from './PlaceCardsCarousel';
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
  const cameraMode = useAppStore((s) => s.cameraMode);
  const setCameraMode = useAppStore((s) => s.setCameraMode);
  const visualStyle = useAppStore((s) => s.visualStyle);
  const setVisualStyle = useAppStore((s) => s.setVisualStyle);
  const followPaused = useAppStore((s) => s.followPaused);
  const setFollowPaused = useAppStore((s) => s.setFollowPaused);
  const positionSource = useAppStore((s) => s.positionSource);
  const hasArrived = useAppStore((s) => s.hasArrived);
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
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

  const isNav3D = ENABLE_NAV3D && cameraMode === 'nav3d';
  const isOverview3D = ENABLE_3D && cameraMode === 'overview3d';

  const mapRef = useRef<MapViewHandle>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0);
  const [activeManeuver, setActiveManeuver] = useState<Maneuver | null>(null);

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

  // Auto-stop timer for friend location sharing
  useEffect(() => {
    const interval = window.setInterval(() => {
      const stopped = checkAutoStop(Date.now());
      if (stopped) {
        setToast('Sharing stopped automatically');
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [checkAutoStop]);

  // Optional demo mode (?demo=1): every 20 seconds move one visible friend
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

  const handleDriftTest = useCallback(() => {
    mapRef.current?.triggerDrift40m();
  }, []);

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
          onManeuverChange={setActiveManeuver}
          onToast={setToast}
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
          onDriftTest={handleDriftTest}
          mode={breakpoint === 'desktop' ? 'docked' : 'floating'}
        />
      )}

      {/* Navigation 3D Top Instruction Banner (dark pill #1E2A3A) */}
      {isNav3D &&
        selectedBuilding &&
        activeManeuver &&
        !hasArrived &&
        (!isMobile || activeTab === 'map') && (
          <div
            className={`pointer-events-none fixed top-0 z-30 flex justify-center px-4 pt-4 ${
              breakpoint === 'desktop'
                ? 'left-[400px] right-0'
                : breakpoint === 'tablet'
                  ? 'left-[356px] right-0'
                  : 'inset-x-0'
            }`}
            style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
          >
            <NavBanner
              building={selectedBuilding}
              maneuver={activeManeuver}
              isSimulated={positionSource === 'sim'}
            />
          </div>
        )}

      {/* Mobile (<768px): Floating SearchBar + top-right 2D/3D toggle (hidden in Nav3D) */}
      {isMobile && activeTab === 'map' && !isNav3D && (
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

      {/* Toast notices (geolocation, auto-stop, recalculating) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none fixed z-40 flex justify-center px-4 ${
            isNav3D ? 'top-[104px]' : 'top-5'
          } ${
            breakpoint === 'desktop'
              ? 'left-[400px] right-0'
              : breakpoint === 'tablet'
                ? 'left-[356px] right-0'
                : isNav3D
                  ? 'inset-x-0 top-[116px]'
                  : 'inset-x-0 top-[76px]'
          }`}
        >
          <div className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-soft md:text-sm">
            {toast}
          </div>
        </div>
      )}

      {/* Right-side MapControls, 3D floor picker / Top view / Re-center, 2D/3D toggle, Attribution */}
      {(!isMobile || activeTab === 'map') && (
        <div
          className={`pointer-events-none absolute right-4 z-10 flex flex-col items-end gap-2.5 transition-all duration-200 ${
            isMobile
              ? selectedBuilding || selectedFriend
                ? isNav3D
                  ? 'bottom-[292px]'
                  : 'bottom-[256px]'
                : 'bottom-[292px]'
              : 'bottom-4'
          }`}
        >
          {/* Floating vertical floor control in Overview 3D */}
          {isOverview3D && selectedBuilding && routeStatus === 'idle' && (
            <VerticalFloorControl building={selectedBuilding} />
          )}

          {/* Re-center button when follow mode is paused by user drag in Nav3D */}
          {isNav3D && followPaused && !hasArrived && (
            <button
              type="button"
              onClick={() => setFollowPaused(false)}
              aria-label="Re-center on walking route"
              className="pointer-events-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-white shadow-soft transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-sm"
            >
              <Crosshair size={16} strokeWidth={2} />
              <span>Re-center</span>
            </button>
          )}

          {/* "Top view" quick switch when routing in Overview 3D */}
          {isOverview3D && routeStatus === 'active' && (
            <button
              type="button"
              onClick={() => setCameraMode('2d')}
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
            bearing={isNav3D ? 0 : bearing}
            onResetNorth={() => mapRef.current?.resetNorth()}
          />

          {/* Desktop/Tablet 2D/3D toggle below zoom controls (hidden during Nav3D since RoutePanel has Overview/2D) */}
          {!isMobile && !isNav3D && <ViewModeToggle align="right" />}

          {/* Dev-only Flat / Illustrated switch (VITE_SHOW_DEV_TOOLS=true) */}
          {SHOW_DEV_TOOLS && ENABLE_ILLUSTRATED && (
            <div
              role="group"
              aria-label="Map visual style"
              className="pointer-events-auto inline-flex items-center rounded-full bg-white p-1 shadow-soft-sm"
            >
              <button
                type="button"
                aria-pressed={visualStyle === 'flat'}
                onClick={() => setVisualStyle('flat')}
                className={`min-h-[36px] rounded-full px-3 text-xs font-bold transition-colors ${
                  visualStyle === 'flat'
                    ? 'bg-ink text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Flat
              </button>
              <button
                type="button"
                aria-pressed={visualStyle === 'illustrated'}
                onClick={() => setVisualStyle('illustrated')}
                className={`min-h-[36px] rounded-full px-3 text-xs font-bold transition-colors ${
                  visualStyle === 'illustrated'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Illustrated
              </button>
            </div>
          )}

          <div className="pointer-events-auto rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-muted shadow-soft-sm backdrop-blur-[2px]">
            © OpenStreetMap contributors
          </div>
        </div>
      )}

      {/* Mobile (<768px): Horizontal Campus Spots Carousel when nothing is selected */}
      {isMobile &&
        activeTab === 'map' &&
        !selectedFriend &&
        !selectedBuilding && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[82px] z-20">
            <PlaceCardsCarousel
              buildings={campusBuildings}
              onSelectPlace={handleSelectBuilding}
              variant="mobile"
            />
          </div>
        )}

      {/* Mobile (<768px): Bottom Sheet for arrival, friend, building, or active route */}
      {isMobile &&
        activeTab === 'map' &&
        (selectedFriend || selectedBuilding) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[76px] z-20">
            {selectedFriend ? (
              <FriendCard
                friend={selectedFriend}
                building={selectedFriendBuilding}
                onRouteToBuilding={(buildingId) => startRoute(buildingId)}
                onClose={clearSelection}
                variant="sheet"
              />
            ) : selectedBuilding && routeStatus === 'active' && hasArrived ? (
              <ArrivalCard
                building={selectedBuilding}
                selectedFloor={selectedFloor}
                onBackToBuilding={endRoute}
                onDone={() => {
                  endRoute();
                  clearSelection();
                }}
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
                onDriftTest={handleDriftTest}
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

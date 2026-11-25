import { LogOut, Map, Users } from 'lucide-react';
import { ENABLE_ILLUSTRATED } from '../lib/constants';
import { searchBuildings } from '../lib/geo';
import { useAppStore } from '../store/useAppStore';
import type { AppTab, Building, SearchResultItem } from '../types';
import { ArrivalCard } from './ArrivalCard';
import { BuildingCard } from './BuildingCard';
import { FriendCard } from './FriendCard';
import { FriendsPanel } from './FriendsPanel';
import { RoutePanel } from './RoutePanel';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';

interface SidebarProps {
  buildings: Building[];
  selectedBuilding: Building | null;
  onSelectBuilding: (id: string, initialFloor?: string) => void;
  onFocusFriend: (userId: string) => void;
  onClearSelection: () => void;
  onDriftTest?: () => void;
  /** 'floating' on tablet (340px rounded with 16px margin), 'docked' on desktop (400px full height) */
  mode: 'floating' | 'docked';
}

const TABS: { id: AppTab; label: string; Icon: typeof Map }[] = [
  { id: 'map', label: 'Map', Icon: Map },
  { id: 'friends', label: 'Friends', Icon: Users },
];

export function Sidebar({
  buildings,
  selectedBuilding,
  onSelectBuilding,
  onFocusFriend,
  onClearSelection,
  onDriftTest,
  mode,
}: SidebarProps) {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setQuery = useAppStore((s) => s.setQuery);
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectedFriendId = useAppStore((s) => s.selectedFriendId);
  const friends = useAppStore((s) => s.friends);
  const route = useAppStore((s) => s.route);
  const routeStatus = useAppStore((s) => s.routeStatus);
  const hasArrived = useAppStore((s) => s.hasArrived);
  const startRoute = useAppStore((s) => s.startRoute);
  const endRoute = useAppStore((s) => s.endRoute);
  const authUser = useAppStore((s) => s.authUser);
  const signOutDemo = useAppStore((s) => s.signOutDemo);

  const selectedFriend = selectedFriendId
    ? friends.find((f) => f.user.id === selectedFriendId) ?? null
    : null;
  const selectedFriendBuilding = selectedFriend?.presence.buildingId
    ? buildings.find((b) => b.id === selectedFriend.presence.buildingId) ?? null
    : null;

  const filteredResults = searchBuildings(buildings, searchQuery);
  const allBuildingItems: SearchResultItem[] = buildings.map((building) => ({
    key: building.id,
    building,
  }));
  const isSearching = searchQuery.trim().length > 0;

  function handlePick(item: SearchResultItem) {
    setQuery('');
    onSelectBuilding(item.building.id, item.matchedRoom?.floor ?? '1');
  }

  return (
    <aside
      aria-label="TitikTemu navigation panel"
      className={
        mode === 'docked'
          ? 'pointer-events-auto absolute inset-y-0 left-0 z-20 flex w-[400px] flex-col bg-white shadow-[8px_0_24px_rgba(30,42,58,0.10)]'
          : 'pointer-events-auto absolute bottom-4 left-4 top-4 z-20 flex w-[340px] flex-col overflow-hidden rounded-card bg-white shadow-soft'
      }
    >
      {/* Top Header: Logo / Wordmark + Sign out/Replay + Pill Tab Switch */}
      <div className="shrink-0 border-b border-[#EEF1F0] px-5 pb-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="TitikTemu logo"
              className="h-10 w-10 shrink-0 rounded-2xl object-contain"
            />
            <div>
              <h1 className="text-lg font-bold leading-tight text-ink">
                TitikTemu
              </h1>
              <p className="text-xs font-medium text-muted">
                {authUser
                  ? authUser.isVisitor
                    ? 'UNTAR Kampus 1 • Visitor'
                    : `Hi, ${authUser.displayName}`
                  : 'UNTAR Kampus 1'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={signOutDemo}
            aria-label="Sign out and show onboarding"
            title="Sign out / Replay onboarding"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-[#F4F8F6] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut size={17} strokeWidth={1.8} />
          </button>
        </div>

        {/* Mint pill switch tabs (Map, Friends) */}
        <div
          role="tablist"
          aria-label="Main sections"
          className="mt-4 flex items-center gap-1.5 rounded-full bg-[#F4F8F6] p-1"
        >
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(id)}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'bg-mint font-bold text-ink shadow-soft-sm'
                    : 'font-semibold text-muted hover:text-ink'
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={1.8}
                  className={isActive ? 'text-[#156A4D]' : 'text-muted'}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* SearchBar (shown on Map tab) */}
        {activeTab === 'map' && (
          <div className="mt-4">
            <SearchBar
              buildings={buildings}
              onPickBuilding={(id, floor) => {
                setQuery('');
                onSelectBuilding(id, floor);
              }}
              mode="inline"
            />
          </div>
        )}
      </div>

      {/* Scrollable sidebar body (never scrolls the page itself) */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeTab === 'map' ? (
          isSearching ? (
            <SearchResults
              results={filteredResults}
              selectedBuildingId={selectedBuildingId}
              onSelect={handlePick}
              heading={`Matching places (${filteredResults.length})`}
            />
          ) : selectedFriend ? (
            <FriendCard
              friend={selectedFriend}
              building={selectedFriendBuilding}
              onRouteToBuilding={(buildingId) => startRoute(buildingId)}
              onClose={onClearSelection}
              variant="sidebar"
            />
          ) : selectedBuilding && routeStatus === 'active' && hasArrived ? (
            <ArrivalCard
              building={selectedBuilding}
              selectedFloor={selectedFloor}
              onBackToBuilding={endRoute}
              onDone={() => {
                endRoute();
                onClearSelection();
              }}
              variant="sidebar"
            />
          ) : selectedBuilding && routeStatus !== 'idle' ? (
            <RoutePanel
              building={selectedBuilding}
              route={route}
              routeStatus={routeStatus}
              onBackToBuilding={endRoute}
              onEndRoute={() => {
                endRoute();
                onClearSelection();
              }}
              onDriftTest={onDriftTest}
              variant="sidebar"
            />
          ) : selectedBuilding ? (
            <BuildingCard
              building={selectedBuilding}
              onClose={onClearSelection}
              variant="sidebar"
            />
          ) : (
            <SearchResults
              results={allBuildingItems}
              selectedBuildingId={selectedBuildingId}
              onSelect={handlePick}
              heading={`Campus buildings (${buildings.length})`}
            />
          )
        ) : (
          <FriendsPanel
            buildings={buildings}
            onFocusFriend={onFocusFriend}
            variant="sidebar"
          />
        )}
      </div>

      {/* About / Info muted honesty note */}
      {ENABLE_ILLUSTRATED && (
        <div className="shrink-0 border-t border-[#EEF1F0] px-5 py-2.5">
          <p className="text-[11px] font-medium text-muted">
            Trees and surface details are illustrative. Building heights are
            estimated.
          </p>
        </div>
      )}
    </aside>
  );
}

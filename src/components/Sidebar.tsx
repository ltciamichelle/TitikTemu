import { Map, MapPin, Users } from 'lucide-react';
import { searchBuildings } from '../lib/geo';
import { useAppStore } from '../store/useAppStore';
import type { AppTab, Building, SearchResultItem } from '../types';
import { BuildingCard } from './BuildingCard';
import { FriendsPanel } from './FriendsPanel';
import { RoutePanel } from './RoutePanel';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';

interface SidebarProps {
  buildings: Building[];
  selectedBuilding: Building | null;
  onSelectBuilding: (id: string, initialFloor?: string) => void;
  onClearSelection: () => void;
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
  onClearSelection,
  mode,
}: SidebarProps) {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setQuery = useAppStore((s) => s.setQuery);
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const route = useAppStore((s) => s.route);
  const routeStatus = useAppStore((s) => s.routeStatus);
  const endRoute = useAppStore((s) => s.endRoute);

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
      {/* Top Header: Logo / Wordmark + Pill Tab Switch */}
      <div className="shrink-0 border-b border-[#EEF1F0] px-5 pb-4 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint text-[#156A4D]">
            <MapPin size={20} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight text-ink">
              TitikTemu
            </h1>
            <p className="text-xs font-medium text-muted">UNTAR Kampus 1</p>
          </div>
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
          <FriendsPanel variant="sidebar" />
        )}
      </div>
    </aside>
  );
}

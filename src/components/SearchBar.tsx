import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchBuildings } from '../lib/geo';
import { useAppStore } from '../store/useAppStore';
import type { Building, SearchResultItem } from '../types';
import { SearchResults } from './SearchResults';

interface SearchBarProps {
  buildings: Building[];
  onPickBuilding: (id: string, initialFloor?: number) => void;
  /** 'floating' shows a dropdown below the pill (mobile). 'inline' renders only the pill input (sidebar renders SearchResults below). */
  mode?: 'floating' | 'inline';
}

export function SearchBar({
  buildings,
  onPickBuilding,
  mode = 'floating',
}: SearchBarProps) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const setQuery = useAppStore((s) => s.setQuery);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = searchBuildings(buildings, searchQuery);
  const showDropdown = mode === 'floating' && isOpen;

  useEffect(() => {
    if (mode !== 'floating') return;
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mode]);

  function handleSelect(item: SearchResultItem) {
    setQuery(item.building.name);
    setIsOpen(false);
    onPickBuilding(item.building.id, item.matchedRoom?.floor ?? 1);
  }

  return (
    <div
      ref={containerRef}
      className={
        mode === 'floating'
          ? 'pointer-events-auto relative mx-4'
          : 'relative w-full'
      }
    >
      <div
        className={`flex min-h-[48px] items-center gap-2.5 rounded-full px-4 ${
          mode === 'floating'
            ? 'bg-white shadow-soft'
            : 'bg-[#F4F8F6] focus-within:bg-white focus-within:ring-2 focus-within:ring-primary'
        }`}
      >
        <Search size={18} strokeWidth={1.8} className="shrink-0 text-primary" />
        <input
          type="text"
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Search buildings, rooms..."
          aria-label="Search buildings or rooms"
          className="min-h-[44px] w-full bg-transparent text-sm font-medium text-ink placeholder:text-muted focus:outline-none"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setIsOpen(true);
            }}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="mt-2 max-h-[300px] overflow-y-auto rounded-card bg-white p-2 shadow-soft">
          <SearchResults
            results={results}
            selectedBuildingId={selectedBuildingId}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  );
}

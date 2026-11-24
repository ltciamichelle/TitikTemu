import { Building2, DoorOpen } from 'lucide-react';
import { formatFloorLabel, formatPinInitials } from '../lib/geo';
import type { SearchResultItem } from '../types';

interface SearchResultsProps {
  results: SearchResultItem[];
  selectedBuildingId: string | null;
  onSelect: (item: SearchResultItem) => void;
  heading?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function SearchResults({
  results,
  selectedBuildingId,
  onSelect,
  heading,
  emptyTitle = 'No place found.',
  emptySubtitle = 'Try another name.',
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-sm font-bold text-ink">{emptyTitle}</p>
        <p className="mt-1 text-xs font-medium text-muted md:text-sm">
          {emptySubtitle}
        </p>
      </div>
    );
  }

  return (
    <div>
      {heading && (
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">
          {heading}
        </p>
      )}
      <ul
        role="listbox"
        aria-label={heading ?? 'Campus buildings'}
        className="flex flex-col gap-1.5"
      >
        {results.map((item) => {
          const { building: b, matchedRoom } = item;
          const isSelected = !matchedRoom && selectedBuildingId === b.id;
          const floorLabel = matchedRoom
            ? formatFloorLabel(matchedRoom.floor)
            : null;
          return (
            <li key={item.key}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(item)}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-button px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'bg-mint/70'
                    : 'hover:bg-[#F4F8F6] active:bg-mint/40'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-mint text-[#156A4D]'
                  }`}
                >
                  {formatPinInitials(b.shortName)}
                </span>
                <div className="min-w-0 flex-1">
                  {matchedRoom ? (
                    <>
                      <p className="truncate text-sm font-bold text-ink">
                        {matchedRoom.name}, {b.name}, {floorLabel}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-xs font-semibold text-[#156A4D]">
                          <DoorOpen size={12} strokeWidth={1.8} />
                          {floorLabel} • {b.name}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="truncate text-sm font-bold text-ink">
                        {b.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF1F0] px-2 py-0.5 text-xs font-medium text-muted">
                          <Building2 size={12} strokeWidth={1.8} />
                          {b.category
                            ? b.category.charAt(0).toUpperCase() +
                              b.category.slice(1)
                            : 'Campus building'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

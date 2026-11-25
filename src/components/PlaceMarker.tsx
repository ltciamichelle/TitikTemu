import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { formatPinInitials } from '../lib/geo';
import type { Building } from '../types';

interface PlaceMarkerProps {
  building: Building;
  isSelected: boolean;
  showLabel: boolean;
  isLabelHiddenByOverlap: boolean;
  liftOffsetPx?: number;
  onSelect: (id: string) => void;
  onHoverChange?: (id: string | null) => void;
}

export function PlaceMarker({
  building,
  isSelected,
  showLabel,
  isLabelHiddenByOverlap,
  liftOffsetPx = 0,
  onSelect,
  onHoverChange,
}: PlaceMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const initials = formatPinInitials(building.shortName);
  const displayLabel =
    showLabel && (!isLabelHiddenByOverlap || isSelected || isHovered);

  return (
    <div
      className="flex flex-col items-center select-none"
      style={
        liftOffsetPx > 0
          ? { transform: `translateY(-${Math.round(liftOffsetPx)}px)` }
          : undefined
      }
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(building.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange?.(null);
      }}
    >
      <button
        type="button"
        aria-label={`Select ${building.name}`}
        aria-pressed={isSelected}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(building.id);
        }}
        className="group relative flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {/* Selected soft mint/emerald architectural halo (distinct from round friend avatars) */}
        {isSelected && (
          <>
            <span
              className="pointer-events-none absolute h-[64px] w-[64px] rounded-[22px]"
              style={{ backgroundColor: 'rgba(46, 211, 154, 0.16)' }}
            />
            <span
              className="pointer-events-none absolute h-[54px] w-[54px] rounded-[18px]"
              style={{ backgroundColor: 'rgba(46, 211, 154, 0.28)' }}
            />
          </>
        )}

        {/* Rounded-square building badge (distinct from round FriendPin avatars) */}
        <span
          className={`relative z-10 flex items-center justify-center gap-1 overflow-hidden rounded-[14px] border-2 shadow-soft transition-all duration-200 ${
            isSelected
              ? 'h-[44px] min-w-[46px] scale-105 border-primary bg-ink px-2 text-white'
              : 'h-[40px] min-w-[42px] border-white bg-white px-2 text-ink group-hover:scale-105 group-hover:border-primary/60 group-hover:shadow-[0_10px_28px_rgba(30,42,58,0.16)] md:h-[38px] md:min-w-[40px]'
          }`}
        >
          {building.photo ? (
            <img
              src={building.photo}
              alt={building.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <Building2
                size={14}
                strokeWidth={2}
                className={isSelected ? 'shrink-0 text-primary' : 'shrink-0 text-[#156A4D]'}
              />
              <span
                className={`font-bold leading-none tracking-tight ${
                  initials.length > 2 ? 'text-xs' : 'text-sm'
                }`}
              >
                {initials}
              </span>
            </>
          )}
        </span>

        {/* Small bottom architectural pointer */}
        <span
          className={`pointer-events-none absolute z-0 h-2.5 w-2.5 rotate-45 shadow-sm transition-all duration-200 ${
            isSelected
              ? 'bottom-[-3px] bg-ink'
              : 'bottom-[0px] bg-white md:bottom-[1px]'
          }`}
        />
      </button>

      {/* Architectural building tag (rectangular with border, distinct from friend speech bubbles) */}
      {displayLabel && (
        <span
          className={`pointer-events-none mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide leading-tight transition-colors ${
            isSelected
              ? 'border-primary/60 bg-ink text-white shadow-soft-sm'
              : 'border-[#D5DFDA] bg-[#F4F8F6]/95 text-[#2C3E50] shadow-soft-sm backdrop-blur-[2px]'
          }`}
        >
          {building.name}
        </span>
      )}
    </div>
  );
}

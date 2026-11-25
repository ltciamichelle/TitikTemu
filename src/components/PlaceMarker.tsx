import { useState } from 'react';
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
        className="group relative flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {/* Selected soft orange halo ring (#FF8A3D at 25%) */}
        {isSelected && (
          <>
            <span
              className="pointer-events-none absolute h-[76px] w-[76px] rounded-full"
              style={{ backgroundColor: 'rgba(255, 138, 61, 0.14)' }}
            />
            <span
              className="pointer-events-none absolute h-[62px] w-[62px] rounded-full"
              style={{ backgroundColor: 'rgba(255, 138, 61, 0.25)' }}
            />
          </>
        )}

        {/* Round badge: 44px on mobile, 40px on desktop (larger when selected) */}
        <span
          className={`relative z-10 flex items-center justify-center overflow-hidden rounded-full border-[3px] border-white shadow-soft transition-all duration-200 ${
            isSelected
              ? 'h-[50px] w-[50px] scale-105 bg-accent text-white'
              : 'h-[44px] w-[44px] bg-mint text-ink group-hover:scale-110 group-hover:shadow-[0_10px_28px_rgba(30,42,58,0.16)] md:h-[40px] md:w-[40px]'
          }`}
        >
          {building.photo ? (
            <img
              src={building.photo}
              alt={building.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className={`font-bold leading-none ${
                initials.length > 2 ? 'text-xs' : 'text-sm'
              }`}
            >
              {initials}
            </span>
          )}
        </span>

        {/* Small bottom pin tip */}
        <span
          className={`pointer-events-none absolute z-0 h-2.5 w-2.5 rotate-45 bg-white shadow-sm transition-all duration-200 ${
            isSelected ? 'bottom-[-4px]' : 'bottom-[-1px] md:bottom-[1px]'
          }`}
        />
      </button>

      {/* Full building label: white-space nowrap, never clipped, shown at zoom >= 16.5 */}
      {displayLabel && (
        <span
          className={`pointer-events-none mt-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight transition-colors ${
            isSelected
              ? 'bg-ink text-white shadow-soft-sm'
              : 'bg-white/90 text-muted shadow-soft-sm backdrop-blur-[2px]'
          }`}
        >
          {building.name}
        </span>
      )}
    </div>
  );
}

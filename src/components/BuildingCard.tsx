import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  DoorOpen,
  Navigation,
  X,
} from 'lucide-react';
import {
  formatFloorLabel,
  formatPinInitials,
  getBuildingFloors,
} from '../lib/geo';
import { useAppStore } from '../store/useAppStore';
import type { Building } from '../types';

interface BuildingCardProps {
  building: Building;
  onClose: () => void;
  variant?: 'sheet' | 'sidebar';
}

const SHOW_DATA_NOTES =
  import.meta.env.VITE_SHOW_DATA_NOTES === 'true' && !import.meta.env.PROD;

function capitalizeCategory(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function BuildingCard({
  building,
  onClose,
  variant = 'sheet',
}: BuildingCardProps) {
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const setFloor = useAppStore((s) => s.setFloor);

  // Mobile sheet starts in peek state and expands on tap or swipe up
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  // Reset mobile sheet to peek when building changes
  useEffect(() => {
    setIsExpanded(false);
    setDragOffsetY(0);
  }, [building.id]);

  // Keep selected floor chip scrolled into view
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'nearest',
      block: 'nearest',
    });
  }, [selectedFloor, isExpanded, variant]);

  const initials = formatPinInitials(building.shortName);
  const floorKeys = getBuildingFloors(building);
  const currentRooms = building.rooms[selectedFloor] ?? [];
  const selectedFloorLabel = formatFloorLabel(selectedFloor);

  const isSheet = variant === 'sheet';
  const showFullBody = !isSheet || isExpanded;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSheet) return;
    dragStartYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSheet || dragStartYRef.current === null) return;
    const dy = e.clientY - dragStartYRef.current;
    // Allow slight visual drag feedback
    setDragOffsetY(Math.max(-48, Math.min(120, dy)));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSheet || dragStartYRef.current === null) return;
    const dy = e.clientY - dragStartYRef.current;
    dragStartYRef.current = null;
    setDragOffsetY(0);

    if (Math.abs(dy) < 8) {
      // Tap on drag handle toggles expand/collapse
      setIsExpanded((prev) => !prev);
      return;
    }

    if (dy < -36) {
      // Swiped up -> expand
      setIsExpanded(true);
    } else if (dy > 52) {
      // Swiped down -> collapse if expanded, or close if in peek
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        onClose();
      }
    }
  }

  return (
    <section
      aria-label={`Selected building: ${building.name}`}
      style={
        isSheet && dragOffsetY !== 0
          ? { transform: `translateY(${dragOffsetY}px)` }
          : undefined
      }
      className={
        isSheet
          ? 'pointer-events-auto mx-4 mb-3 flex max-h-[68dvh] flex-col overflow-hidden rounded-card bg-white shadow-soft transition-transform duration-150'
          : 'flex flex-col rounded-card bg-[#F7FAF9] p-4 shadow-soft-sm'
      }
    >
      {/* Mobile drag handle (swipe up to expand, swipe down to collapse/close) */}
      {isSheet && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragStartYRef.current = null;
            setDragOffsetY(0);
          }}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse building details' : 'Expand building details'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded((prev) => !prev);
            }
          }}
          className="flex cursor-grab touch-none flex-col items-center pb-1 pt-2.5 active:cursor-grabbing"
        >
          <span className="h-1 w-10 rounded-full bg-[#DCE4E1]" />
        </div>
      )}

      {/* Desktop/Tablet Sidebar Back Button */}
      {!isSheet && (
        <button
          type="button"
          onClick={onClose}
          className="-ml-2 mb-3 inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-full px-2.5 text-sm font-semibold text-muted transition-colors hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          <span>All buildings</span>
        </button>
      )}

      {/* Card Inner Content (scrollable on mobile expanded sheet) */}
      <div
        className={
          isSheet
            ? 'flex-1 overflow-y-auto px-4 pb-4 pt-1'
            : 'flex flex-col'
        }
      >
        {/* Header Row: Photo slot + Name + Category/Open now badges */}
        <div
          onClick={() => {
            if (isSheet && !isExpanded) setIsExpanded(true);
          }}
          className={`flex items-start gap-3 ${
            isSheet && !isExpanded ? 'cursor-pointer' : ''
          }`}
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-button bg-mint text-lg font-bold text-[#156A4D]">
            {building.photo ? (
              <img
                src={building.photo}
                alt={building.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {(building.category || building.hours) && (
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                {building.category && (
                  <span className="rounded-full bg-[#EEF1F0] px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {capitalizeCategory(building.category)}
                  </span>
                )}
                {building.hours && (
                  <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-[#156A4D]">
                    Open now
                  </span>
                )}
              </div>
            )}

            <h2 className="text-lg font-bold leading-snug text-ink md:text-xl">
              {building.name}
            </h2>

            {building.oldNameVerified && building.oldName && (
              <p className="mt-0.5 text-xs font-medium text-muted">
                Previously {building.oldName}
              </p>
            )}

            {isSheet && !isExpanded && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-muted">
                <span>Tap for floors &amp; rooms</span>
                <ChevronUp size={14} strokeWidth={2} />
              </p>
            )}
          </div>

          {isSheet && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isExpanded) {
                  setIsExpanded(false);
                } else {
                  onClose();
                }
              }}
              aria-label={isExpanded ? 'Collapse sheet' : 'Close building card'}
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-[#F4F8F6] hover:text-ink"
            >
              {isExpanded ? (
                <ChevronDown size={20} strokeWidth={1.8} />
              ) : (
                <X size={18} strokeWidth={1.8} />
              )}
            </button>
          )}
        </div>

        {/* Full Details (shown in sidebar or when mobile sheet is expanded) */}
        {showFullBody && (
          <div className="mt-4 flex flex-col gap-4">
            {/* Hours & Description */}
            <div className="flex flex-col gap-1.5 rounded-button bg-white/80 p-3 md:bg-white">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink md:text-sm">
                <Clock size={15} strokeWidth={1.8} className="shrink-0 text-primary" />
                <span>{building.hours ?? 'Info coming soon'}</span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-muted md:text-sm">
                {building.description ?? 'Info coming soon'}
              </p>
            </div>

            {/* Floor Selector (horizontally scrollable with snap, 44px touch targets) */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  Floors ({floorKeys.length})
                </span>
                {SHOW_DATA_NOTES && (
                  <span className="text-xs font-medium text-muted">
                    {building.floorsOverride
                      ? 'Unverified floor count'
                      : 'Floors from OSM, to be verified'}
                  </span>
                )}
              </div>

              <div
                role="tablist"
                aria-label="Select floor"
                className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1"
              >
                {floorKeys.map((floorKey) => {
                  const isActive = selectedFloor === floorKey;
                  return (
                    <button
                      key={floorKey}
                      ref={isActive ? activeChipRef : null}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setFloor(floorKey)}
                      className={`flex min-h-[44px] min-w-[48px] shrink-0 snap-start items-center justify-center rounded-full px-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? 'bg-primary text-white shadow-soft-sm'
                          : 'bg-[#EEF1F0] text-ink hover:bg-mint/60'
                      }`}
                    >
                      {formatFloorLabel(floorKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rooms Panel for selected floor */}
            <div className="rounded-button bg-[#F4F8F6] p-3.5 md:bg-white">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                <DoorOpen size={14} strokeWidth={1.8} />
                <span>Rooms on {selectedFloorLabel}</span>
              </div>

              {currentRooms.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {currentRooms.map((room, idx) => (
                    <li
                      key={`${selectedFloor}-${idx}`}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink md:bg-[#F7FAF9] md:text-sm"
                    >
                      {room}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs font-medium text-muted md:text-sm">
                  Room list coming soon for {selectedFloorLabel}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons: Close + Disabled Start route ("Route comes next") */}
        <div className="mt-4 flex items-center gap-2.5">
          {showFullBody && (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] items-center justify-center rounded-button bg-[#EEF1F0] px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-[#E2E7E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Close
            </button>
          )}

          <button
            type="button"
            disabled
            aria-disabled="true"
            className="flex min-h-[44px] flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-button bg-primary/40 px-4 py-2.5 text-sm font-bold text-[#145B43]"
          >
            <Navigation size={16} strokeWidth={1.8} />
            <span>Route comes next</span>
          </button>
        </div>
      </div>
    </section>
  );
}

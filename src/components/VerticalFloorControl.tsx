import { useEffect, useRef } from 'react';
import { formatFloorLabel, getBuildingFloors } from '../lib/geo';
import { useAppStore } from '../store/useAppStore';
import type { Building } from '../types';

interface VerticalFloorControlProps {
  building: Building;
}

export function VerticalFloorControl({ building }: VerticalFloorControlProps) {
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const setFloor = useAppStore((s) => s.setFloor);
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);

  const floors = getBuildingFloors(building);

  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedFloor, building.id]);

  // Only show vertical floor control if building has more than 1 floor
  if (floors.length <= 1) return null;

  // Stack highest floor at the top (like an elevator / building cross-section)
  const orderedFloors = [...floors].reverse();

  return (
    <div
      role="tablist"
      aria-label={`Floors in ${building.name}`}
      aria-orientation="vertical"
      className="no-scrollbar pointer-events-auto flex max-h-[176px] flex-col items-center gap-1 overflow-y-auto overscroll-contain rounded-full bg-white/95 p-1 shadow-soft backdrop-blur-[2px] md:max-h-[240px]"
    >
      {orderedFloors.map((floorKey) => {
        const isActive = selectedFloor === floorKey;
        return (
          <button
            key={floorKey}
            ref={isActive ? activeBtnRef : null}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Select floor ${formatFloorLabel(floorKey)}`}
            onClick={() => setFloor(floorKey)}
            className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isActive
                ? 'bg-primary text-white shadow-soft-sm'
                : 'text-ink hover:bg-mint/60'
            }`}
          >
            {formatFloorLabel(floorKey)}
          </button>
        );
      })}
    </div>
  );
}

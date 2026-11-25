import { formatFloorLabel } from '../lib/geo';
import type { Building } from '../types';

/**
 * Flat ground heading cone + pulsing ring (rendered inside a MapLibre Marker
 * with pitchAlignment="map" and rotationAlignment="map").
 */
export function GroundUserCone({ headingDeg }: { headingDeg: number }) {
  return (
    <div
      className="pointer-events-none relative flex h-28 w-28 items-center justify-center select-none"
      style={{ transform: `rotate(${headingDeg}deg)` }}
    >
      {/* Pulsing ground ring */}
      <span className="nav-pulse-ring absolute h-14 w-14 rounded-full bg-primary/30" />

      {/* Heading cone pointing up (0 deg = north, rotated by headingDeg) */}
      <svg
        width="88"
        height="88"
        viewBox="0 0 88 88"
        className="absolute"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="navConeGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#2ED39A" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2ED39A" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d="M44 44 L22 6 A44 44 0 0 1 66 6 Z" fill="url(#navConeGrad)" />
      </svg>
    </div>
  );
}

/**
 * Upright screen-aligned user avatar circle (44px, white 3px border, soft shadow).
 */
export function NavUserAvatar() {
  return (
    <div
      className="pointer-events-none flex h-[44px] w-[44px] items-center justify-center rounded-full border-[3px] border-white bg-primary text-xs font-bold text-white shadow-soft select-none"
      aria-label="Your walking position"
    >
      You
    </div>
  );
}

/**
 * Flat white arrow with thin green outline placed on the ground at the next maneuver.
 */
export function GroundManeuverArrow({
  headingDeg,
  distanceM,
}: {
  headingDeg: number;
  distanceM: number;
}) {
  return (
    <div className="pointer-events-none relative flex items-center justify-center select-none">
      <div style={{ transform: `rotate(${headingDeg}deg)` }}>
        <svg
          width="38"
          height="38"
          viewBox="0 0 38 38"
          aria-hidden="true"
          className="drop-shadow-sm"
        >
          <path
            d="M19 4 L32 28 L19 22 L6 28 Z"
            fill="#FFFFFF"
            stroke="#2ED39A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="ml-1 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink shadow-soft-sm">
        {Math.max(0, Math.round(distanceM))} m
      </span>
    </div>
  );
}

/**
 * Floating HTML chip above the destination building's roof in Navigation 3D.
 */
export function DestinationRoofChip({
  building,
  selectedFloor,
  liftOffsetPx,
}: {
  building: Building;
  selectedFloor: string;
  liftOffsetPx: number;
}) {
  const floorLabel = selectedFloor ? formatFloorLabel(selectedFloor) : null;
  return (
    <div
      className="pointer-events-none flex flex-col items-center select-none"
      style={
        liftOffsetPx > 0
          ? { transform: `translateY(-${Math.round(liftOffsetPx)}px)` }
          : undefined
      }
    >
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-white bg-ink px-3 py-1.5 text-xs font-bold text-white shadow-soft">
        <span>{building.name}</span>
        {floorLabel && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-ink">
            {floorLabel}
          </span>
        )}
      </div>
      <span className="h-2.5 w-2.5 -translate-y-1 rotate-45 bg-ink" />
    </div>
  );
}

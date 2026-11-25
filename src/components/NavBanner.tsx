import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Undo2,
  Redo2,
} from 'lucide-react';
import type { Maneuver } from '../lib/navigation';
import type { Building } from '../types';

interface NavBannerProps {
  building: Building;
  maneuver: Maneuver;
  isSimulated: boolean;
}

function getManeuverIcon(type: Maneuver['type']) {
  switch (type) {
    case 'left':
      return CornerUpLeft;
    case 'right':
      return CornerUpRight;
    case 'sharp-left':
      return Undo2;
    case 'sharp-right':
      return Redo2;
    case 'arrive':
      return Flag;
    case 'straight':
    default:
      return ArrowUp;
  }
}

function getPrimaryInstruction(maneuver: Maneuver, buildingName: string): string {
  const dist = Math.max(0, Math.round(maneuver.distanceToM));
  switch (maneuver.type) {
    case 'left':
      return `Turn left in ${dist} m`;
    case 'right':
      return `Turn right in ${dist} m`;
    case 'sharp-left':
      return `Sharp left in ${dist} m`;
    case 'sharp-right':
      return `Sharp right in ${dist} m`;
    case 'straight':
      return `Walk straight ${dist} m`;
    case 'arrive':
    default:
      return `Arrive at ${buildingName} in ${dist} m`;
  }
}

export function NavBanner({
  building,
  maneuver,
  isSimulated,
}: NavBannerProps) {
  const Icon = getManeuverIcon(maneuver.type);
  const primaryText = getPrimaryInstruction(maneuver, building.name);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex w-full max-w-[420px] flex-col items-center gap-1.5"
    >
      <div className="flex w-full items-center gap-3 rounded-full bg-ink px-4 py-3 text-white shadow-soft">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
          <Icon size={20} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight md:text-base">
            {primaryText}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-white/75">
            Toward {building.name} entrance
          </p>
        </div>
      </div>

      {isSimulated && (
        <span className="rounded-full bg-white/95 px-3 py-0.5 text-xs font-bold text-[#156A4D] shadow-soft-sm">
          Simulated walk
        </span>
      )}
    </div>
  );
}

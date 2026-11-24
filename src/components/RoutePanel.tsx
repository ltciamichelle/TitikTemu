import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Footprints,
  MapPin,
  X,
} from 'lucide-react';
import type { RouteResult } from '../lib/routing';
import type { RouteStatus } from '../store/useAppStore';
import type { Building } from '../types';

interface RoutePanelProps {
  building: Building;
  route: RouteResult | null;
  routeStatus: RouteStatus;
  onEndRoute: () => void;
  onBackToBuilding: () => void;
  variant?: 'sheet' | 'sidebar';
}

export function RoutePanel({
  building,
  route,
  routeStatus,
  onEndRoute,
  onBackToBuilding,
  variant = 'sheet',
}: RoutePanelProps) {
  const isSheet = variant === 'sheet';

  if (routeStatus === 'no_path' || !route) {
    return (
      <section
        aria-label="No walking path found"
        className={
          isSheet
            ? 'pointer-events-auto mx-4 mb-3 flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft'
            : 'flex flex-col gap-3 rounded-card bg-[#F7FAF9] p-4 shadow-soft-sm'
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF3EB] text-accent">
            <AlertTriangle size={20} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink md:text-lg">
              No walking path found
            </h2>
            <p className="mt-0.5 text-xs font-medium text-muted md:text-sm">
              Could not find a connected campus path to {building.name}.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToBuilding}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button bg-[#EEF1F0] px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-[#E2E7E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          <span>Back</span>
        </button>
      </section>
    );
  }

  const roundedMeters = Math.round(route.meters);

  return (
    <section
      aria-label={`Walking route to ${building.name}`}
      className={
        isSheet
          ? 'pointer-events-auto mx-4 mb-3 flex flex-col gap-3.5 rounded-card bg-white p-4 shadow-soft'
          : 'flex flex-col gap-4 rounded-card bg-[#F7FAF9] p-4 shadow-soft-sm'
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-[#156A4D]">
            <Footprints size={13} strokeWidth={2} />
            Walking route
          </span>
          <h2 className="mt-1.5 text-lg font-bold leading-snug text-ink md:text-xl">
            To {building.name}
          </h2>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted md:text-sm">
            <MapPin size={14} strokeWidth={1.8} className="text-primary" />
            <span>From: You</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onEndRoute}
          aria-label="End route"
          className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-[#EEF1F0] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* Distance & Walking Time */}
      <div className="flex items-center gap-3 rounded-button bg-[#F4F8F6] px-3.5 py-3 md:bg-white">
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-semibold text-muted">Distance</span>
          <span className="text-xl font-bold text-ink">{roundedMeters} m</span>
        </div>
        <div className="h-9 w-px bg-[#DCE4E1]" />
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-semibold text-muted">Est. time</span>
          <span className="inline-flex items-center gap-1.5 text-xl font-bold text-ink">
            <Clock size={18} strokeWidth={1.8} className="text-primary" />
            {route.minutes} min walk
          </span>
        </div>
      </div>

      {/* Estimated / manual edge note */}
      {route.usesManual && (
        <div className="flex items-start gap-2 rounded-button bg-[#FFF7F0] px-3 py-2.5 text-xs font-medium text-[#8C4A1C] md:text-sm">
          <AlertTriangle
            size={16}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0 text-accent"
          />
          <span>Part of this route is estimated. Path to be verified.</span>
        </div>
      )}

      {/* Action Buttons: Back to building + End route (accent #FF8A3D) */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBackToBuilding}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-button bg-[#EEF1F0] px-3.5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-[#E2E7E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          <span>Back to building</span>
        </button>

        <button
          type="button"
          onClick={onEndRoute}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-button bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#f07b2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span>End route</span>
        </button>
      </div>
    </section>
  );
}

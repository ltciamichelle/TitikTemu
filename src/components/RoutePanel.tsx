import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Compass,
  Eye,
  Footprints,
  MapPin,
  Navigation,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { ENABLE_NAV3D, SHOW_DEV_TOOLS } from '../lib/constants';
import { etaMinutes } from '../lib/navigation';
import type { RouteResult } from '../lib/routing';
import {
  useAppStore,
  type RouteStatus,
  type SimSpeed,
} from '../store/useAppStore';
import type { Building } from '../types';

interface RoutePanelProps {
  building: Building;
  route: RouteResult | null;
  routeStatus: RouteStatus;
  onEndRoute: () => void;
  onBackToBuilding: () => void;
  onDriftTest?: () => void;
  variant?: 'sheet' | 'sidebar';
}

const SIM_SPEEDS: SimSpeed[] = [1, 3, 6];

export function RoutePanel({
  building,
  route,
  routeStatus,
  onEndRoute,
  onBackToBuilding,
  onDriftTest,
  variant = 'sheet',
}: RoutePanelProps) {
  const cameraMode = useAppStore((s) => s.cameraMode);
  const setCameraMode = useAppStore((s) => s.setCameraMode);
  const enterNav3D = useAppStore((s) => s.enterNav3D);
  const positionSource = useAppStore((s) => s.positionSource);
  const setPositionSource = useAppStore((s) => s.setPositionSource);
  const distanceAlongM = useAppStore((s) => s.distanceAlongM);
  const simSpeed = useAppStore((s) => s.simSpeed);
  const setSimSpeed = useAppStore((s) => s.setSimSpeed);
  const simPlaying = useAppStore((s) => s.simPlaying);
  const setSimPlaying = useAppStore((s) => s.setSimPlaying);

  const isSheet = variant === 'sheet';
  const isNav3D = ENABLE_NAV3D && cameraMode === 'nav3d';

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

  const remainingMeters = Math.max(0, route.meters - distanceAlongM);
  const roundedMeters = Math.round(remainingMeters);
  const remainingMin = etaMinutes(remainingMeters);

  return (
    <section
      aria-label={`Walking route to ${building.name}`}
      className={
        isSheet
          ? 'pointer-events-auto mx-3 mb-2 flex max-h-[58dvh] flex-col gap-2.5 overflow-y-auto overscroll-contain rounded-card bg-white p-3.5 shadow-soft sm:mx-4 sm:mb-3 sm:gap-3 sm:p-4'
          : 'flex flex-col gap-3.5 rounded-card bg-[#F7FAF9] p-4 shadow-soft-sm'
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-[#156A4D]">
              <Footprints size={13} strokeWidth={2} />
              {isNav3D ? 'Navigation 3D' : 'Walking route'}
            </span>
            {isNav3D && positionSource === 'sim' && (
              <span className="rounded-full bg-[#EEF1F0] px-2.5 py-0.5 text-[11px] font-bold text-ink">
                Simulated walk
              </span>
            )}
          </div>
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

      {/* Remaining Distance & ETA */}
      <div className="flex items-center gap-3 rounded-button bg-[#F4F8F6] px-3.5 py-2.5 md:bg-white">
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-semibold text-muted">Remaining</span>
          <span className="text-lg font-bold text-ink md:text-xl">
            {roundedMeters} m
          </span>
        </div>
        <div className="h-8 w-px bg-[#DCE4E1]" />
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-semibold text-muted">Est. time</span>
          <span className="inline-flex items-center gap-1.5 text-lg font-bold text-ink md:text-xl">
            <Clock size={17} strokeWidth={1.8} className="text-primary" />
            {remainingMin} min walk
          </span>
        </div>
      </div>

      {/* Estimated / manual edge note */}
      {route.usesManual && (
        <div className="flex items-start gap-2 rounded-button bg-[#FFF7F0] px-3 py-2 text-xs font-medium text-[#8C4A1C]">
          <AlertTriangle
            size={15}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0 text-accent"
          />
          <span>Part of this route is estimated. Path to be verified.</span>
        </div>
      )}

      {/* Navigation 3D controls: Simulate walk toggle, Play/Pause, 1x/3x/6x, Overview & 2D */}
      {isNav3D ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-button bg-[#F4F8F6] px-3 py-2 md:bg-white">
            <button
              type="button"
              onClick={() =>
                setPositionSource(positionSource === 'sim' ? 'gps' : 'sim')
              }
              aria-pressed={positionSource === 'sim'}
              className={`min-h-[36px] rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                positionSource === 'sim'
                  ? 'bg-mint text-[#156A4D]'
                  : 'bg-[#EEF1F0] text-muted hover:text-ink'
              }`}
            >
              Simulate walk: {positionSource === 'sim' ? 'On' : 'Off'}
            </button>

            {positionSource === 'sim' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSimPlaying(!simPlaying)}
                  aria-label={simPlaying ? 'Pause simulated walk' : 'Play simulated walk'}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {simPlaying ? (
                    <Pause size={15} strokeWidth={2.2} />
                  ) : (
                    <Play size={15} strokeWidth={2.2} />
                  )}
                </button>
                {SIM_SPEEDS.map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    aria-pressed={simSpeed === spd}
                    onClick={() => setSimSpeed(spd)}
                    className={`min-h-[36px] min-w-[36px] rounded-full px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      simSpeed === spd
                        ? 'bg-ink text-white'
                        : 'bg-[#EEF1F0] text-ink hover:bg-mint/60'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Camera mode quick switches: Overview & 2D (+ dev Drift 40 m) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCameraMode('overview3d')}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-button bg-[#EEF1F0] px-3 text-xs font-bold text-ink transition-colors hover:bg-mint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Compass size={15} strokeWidth={1.8} />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('2d')}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-button bg-[#EEF1F0] px-3 text-xs font-bold text-ink transition-colors hover:bg-mint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Eye size={15} strokeWidth={1.8} />
              <span>2D</span>
            </button>
            {SHOW_DEV_TOOLS && onDriftTest && (
              <button
                type="button"
                onClick={onDriftTest}
                className="flex min-h-[40px] items-center justify-center rounded-button bg-[#FFF3EB] px-3 text-xs font-bold text-[#8C4A1C] transition-colors hover:bg-[#FFE6D6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Drift 40 m
              </button>
            )}
          </div>
        </div>
      ) : (
        ENABLE_NAV3D && (
          <button
            type="button"
            onClick={enterNav3D}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Navigation size={16} strokeWidth={1.8} />
            <span>Start walking</span>
          </button>
        )
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

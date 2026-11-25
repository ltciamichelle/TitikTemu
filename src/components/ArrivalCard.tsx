import { ArrowLeft, CheckCircle2, DoorOpen } from 'lucide-react';
import { formatFloorLabel } from '../lib/geo';
import type { Building } from '../types';

interface ArrivalCardProps {
  building: Building;
  selectedFloor: string;
  onDone: () => void;
  onBackToBuilding: () => void;
  variant?: 'sheet' | 'sidebar';
}

export function ArrivalCard({
  building,
  selectedFloor,
  onDone,
  onBackToBuilding,
  variant = 'sheet',
}: ArrivalCardProps) {
  const isSheet = variant === 'sheet';
  const floorLabel = formatFloorLabel(selectedFloor);
  const rooms = building.rooms[selectedFloor] ?? [];

  return (
    <section
      aria-label={`Arrived at ${building.name}`}
      className={
        isSheet
          ? 'pointer-events-auto mx-4 mb-3 flex flex-col gap-3.5 rounded-card bg-white p-4 shadow-soft'
          : 'flex flex-col gap-4 rounded-card bg-[#F7FAF9] p-4 shadow-soft-sm'
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint text-[#156A4D]">
          <CheckCircle2 size={24} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-[#156A4D]">
            Arrived
          </span>
          <h2 className="mt-1 text-lg font-bold leading-snug text-ink md:text-xl">
            You have arrived at {building.name}
          </h2>
          {selectedFloor && (
            <p className="mt-0.5 text-sm font-semibold text-[#156A4D]">
              Go to {floorLabel}
            </p>
          )}
        </div>
      </div>

      {rooms.length > 0 && (
        <div className="rounded-button bg-[#F4F8F6] p-3 md:bg-white">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <DoorOpen size={14} strokeWidth={1.8} />
            <span>Rooms on {floorLabel}</span>
          </div>
          <ul className="flex max-h-[120px] flex-col gap-1 overflow-y-auto">
            {rooms.map((room, idx) => (
              <li
                key={`${selectedFloor}-${idx}`}
                className="rounded-xl bg-white px-2.5 py-1.5 text-xs font-semibold text-ink md:bg-[#F7FAF9] md:text-sm"
              >
                {room}
              </li>
            ))}
          </ul>
        </div>
      )}

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
          onClick={onDone}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-button bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Done
        </button>
      </div>
    </section>
  );
}

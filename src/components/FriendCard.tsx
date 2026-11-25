import { ArrowLeft, MapPin, Navigation, X } from 'lucide-react';
import { STATUS_BUBBLE_LABELS } from '../lib/friendsRepo';
import type { Building, FriendRecord } from '../types';

interface FriendCardProps {
  friend: FriendRecord;
  building: Building | null;
  onRouteToBuilding: (buildingId: string) => void;
  onClose: () => void;
  variant?: 'sheet' | 'sidebar';
}

export function FriendCard({
  friend,
  building,
  onRouteToBuilding,
  onClose,
  variant = 'sheet',
}: FriendCardProps) {
  const { user, presence } = friend;
  const isSheet = variant === 'sheet';
  const statusLabel = presence.status
    ? STATUS_BUBBLE_LABELS[presence.status]
    : null;
  const initial = user.displayName.trim().charAt(0).toUpperCase();

  return (
    <section
      aria-label={`Friend: ${user.displayName}`}
      className={
        isSheet
          ? 'pointer-events-auto mx-4 mb-3 flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft'
          : 'flex flex-col gap-3.5 rounded-card bg-[#F7FAF9] p-4 shadow-soft-sm'
      }
    >
      {!isSheet && (
        <button
          type="button"
          onClick={onClose}
          className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-full px-2.5 text-sm font-semibold text-muted transition-colors hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          <span>All buildings</span>
        </button>
      )}

      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-base font-bold text-white shadow-soft-sm"
          style={{ backgroundColor: user.avatarColor }}
        >
          {initial}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-base font-bold text-ink md:text-lg">
              {user.displayName}
            </h2>
            <span className="rounded-full bg-[#EEF1F0] px-2 py-0.5 text-[11px] font-semibold text-muted">
              Demo data
            </span>
          </div>

          <p className="text-xs font-medium text-muted">@{user.username}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {statusLabel && (
              <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-[#156A4D]">
                {statusLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink md:text-sm">
              <MapPin size={14} strokeWidth={1.8} className="text-primary" />
              {building ? `At ${building.name}` : 'On campus'}
            </span>
          </div>
        </div>

        {isSheet && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close friend card"
            className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-[#F4F8F6] hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] items-center justify-center rounded-button bg-[#EEF1F0] px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-[#E2E7E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Close
        </button>

        {building && (
          <button
            type="button"
            onClick={() => onRouteToBuilding(building.id)}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-button bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Navigation size={16} strokeWidth={1.8} />
            <span>Route to building</span>
          </button>
        )}
      </div>
    </section>
  );
}

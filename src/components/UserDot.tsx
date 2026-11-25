import { STATUS_BUBBLE_LABELS } from '../lib/friendsRepo';
import type { FriendStatus } from '../types';

interface UserDotProps {
  status?: FriendStatus;
  showStatusBubble?: boolean;
}

export function UserDot({
  status = null,
  showStatusBubble = false,
}: UserDotProps) {
  const bubbleText =
    showStatusBubble && status ? STATUS_BUBBLE_LABELS[status] : null;

  return (
    <div
      className="pointer-events-none flex flex-col items-center select-none"
      aria-label="Your location"
    >
      {bubbleText && (
        <span className="mb-1 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-white shadow-soft-sm">
          {bubbleText}
        </span>
      )}
      <span className="mb-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-ink shadow-soft-sm">
        You
      </span>
      <div className="relative flex h-9 w-9 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: 'rgba(46, 211, 154, 0.25)' }}
        />
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full border-[2.5px] border-white bg-primary text-[10px] font-bold text-white shadow-soft-sm">
          •
        </span>
      </div>
    </div>
  );
}

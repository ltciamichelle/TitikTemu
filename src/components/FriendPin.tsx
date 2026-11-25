import { STATUS_BUBBLE_LABELS } from '../lib/friendsRepo';
import type { FriendRecord } from '../types';

interface FriendPinProps {
  friend: FriendRecord;
  isSelected: boolean;
  onSelect: (userId: string) => void;
}

export function FriendPin({ friend, isSelected, onSelect }: FriendPinProps) {
  const { user, presence } = friend;
  const initial = user.displayName.trim().charAt(0).toUpperCase();
  const bubbleText = presence.status
    ? STATUS_BUBBLE_LABELS[presence.status]
    : null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(user.id);
      }}
      aria-label={`${user.displayName}${bubbleText ? `, ${bubbleText}` : ''}`}
      className="group relative flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 focus:outline-none"
    >
      {/* Status bubble above avatar */}
      {bubbleText && (
        <span className="mb-1 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink shadow-soft-sm">
          {bubbleText}
        </span>
      )}

      {/* 40px round colored avatar with white border & optional halo ring */}
      <span
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white text-sm font-bold text-white shadow-soft transition-transform duration-150 group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 ${
          isSelected ? 'scale-110' : ''
        }`}
        style={{
          backgroundColor: user.avatarColor,
          boxShadow: isSelected
            ? '0 0 0 8px rgba(255, 138, 61, 0.25), 0 8px 20px rgba(30, 42, 58, 0.16)'
            : '0 6px 16px rgba(30, 42, 58, 0.14)',
        }}
      >
        {initial}
      </span>
    </button>
  );
}

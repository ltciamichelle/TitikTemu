import { useState } from 'react';
import { Check, Clock, UserPlus, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { SendRequestResult } from '../types';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFriendModal({ isOpen, onClose }: AddFriendModalProps) {
  const pending = useAppStore((s) => s.pending);
  const sendFriendRequest = useAppStore((s) => s.sendFriendRequest);
  const acceptFriendRequest = useAppStore((s) => s.acceptFriendRequest);

  const [username, setUsername] = useState('');
  const [feedback, setFeedback] = useState<SendRequestResult | null>(null);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = sendFriendRequest(username);
    setFeedback(res);
    if (res.ok) {
      setUsername('');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-friend-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] md:items-center md:p-4"
    >
      <div className="w-full max-w-[400px] rounded-t-card bg-white p-5 shadow-soft md:rounded-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint text-[#156A4D]">
              <UserPlus size={20} strokeWidth={1.8} />
            </span>
            <div>
              <h2 id="add-friend-title" className="text-base font-bold text-ink">
                Add a friend
              </h2>
              <p className="text-xs font-medium text-muted">
                Try @kevin.h or @maya.t (demo users)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add friend dialog"
            className="-mr-1 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-[#F4F8F6] hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2.5">
          <label htmlFor="friend-username" className="sr-only">
            Friend username
          </label>
          <input
            id="friend-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (feedback) setFeedback(null);
            }}
            placeholder="@username"
            className="min-h-[44px] w-full rounded-button bg-[#F4F8F6] px-3.5 text-sm font-medium text-ink placeholder:text-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <button
            type="submit"
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UserPlus size={16} strokeWidth={1.8} />
            <span>Send friend request</span>
          </button>

          {feedback && (
            <p
              role="status"
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                feedback.ok
                  ? 'bg-mint/70 text-[#156A4D]'
                  : 'bg-[#FFF3EB] text-[#8C4A1C]'
              }`}
            >
              {feedback.message}
            </p>
          )}
        </form>

        {/* Pending requests list */}
        <div className="mt-5 border-t border-[#EEF1F0] pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Pending requests ({pending.length})
          </h3>

          {pending.length === 0 ? (
            <p className="mt-2 text-xs font-medium text-muted">
              No pending requests.
            </p>
          ) : (
            <ul className="mt-2.5 flex max-h-[200px] flex-col gap-2 overflow-y-auto">
              {pending.map(({ user, direction }) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-2.5 rounded-button bg-[#F7FAF9] p-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: user.avatarColor }}
                    >
                      {user.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {user.displayName}
                      </p>
                      <p className="truncate text-xs font-medium text-muted">
                        @{user.username}
                      </p>
                    </div>
                  </div>

                  {direction === 'incoming' ? (
                    <button
                      type="button"
                      onClick={() => acceptFriendRequest(user.id)}
                      className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-button bg-primary px-3.5 text-xs font-bold text-white transition-colors hover:bg-[#25be89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Check size={14} strokeWidth={2.2} />
                      <span>Accept</span>
                    </button>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EEF1F0] px-2.5 py-1 text-xs font-semibold text-muted">
                      <Clock size={12} strokeWidth={1.8} />
                      Pending
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

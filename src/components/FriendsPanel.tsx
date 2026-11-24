import { Users } from 'lucide-react';

interface FriendsPanelProps {
  variant?: 'mobile' | 'sidebar';
}

export function FriendsPanel({ variant = 'mobile' }: FriendsPanelProps) {
  if (variant === 'sidebar') {
    return (
      <div className="rounded-card bg-[#F7FAF9] p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint">
          <Users size={22} strokeWidth={1.8} className="text-[#156A4D]" />
        </div>
        <h2 className="mt-3 text-base font-bold text-ink">Coming soon</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Friends list, status bubbles, and privacy controls will be added in
          the next milestone.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#F5FAF8]">
      <header
        className="bg-mint px-4 pb-5 pt-12"
        style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}
      >
        <h1 className="text-2xl font-bold text-ink">Friends</h1>
        <p className="mt-0.5 text-xs font-medium text-[#2E4657]">
          Opt-in campus social map
        </p>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="w-full rounded-card bg-white p-6 text-center shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint">
            <Users size={22} strokeWidth={1.8} className="text-[#156A4D]" />
          </div>
          <h2 className="mt-3 text-base font-bold text-ink">Coming soon</h2>
          <p className="mt-1 text-xs font-medium text-muted">
            Friends list, status bubbles, and privacy controls will be added in
            the next milestone.
          </p>
        </div>
      </div>
    </div>
  );
}

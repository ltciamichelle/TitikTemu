import { Map, Users } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { AppTab } from '../types';

const TABS: { id: AppTab; label: string; Icon: typeof Map }[] = [
  { id: 'map', label: 'Map', Icon: Map },
  { id: 'friends', label: 'Friends', Icon: Users },
];

export function BottomTabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <nav
      aria-label="Main navigation"
      className="pointer-events-auto mx-4 mb-4 flex items-center gap-2 rounded-[28px] bg-white p-2 shadow-soft"
      style={{ marginBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[22px] px-4 py-2.5 text-sm transition-colors ${
              isActive
                ? 'bg-mint font-bold text-ink'
                : 'bg-transparent font-semibold text-muted hover:bg-[#F4F8F6]'
            }`}
          >
            <Icon
              size={18}
              strokeWidth={1.8}
              className={isActive ? 'text-[#156A4D]' : 'text-muted'}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

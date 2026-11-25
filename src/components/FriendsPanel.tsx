import { useState } from 'react';
import {
  Building2,
  EyeOff,
  Radio,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  isDemoMode,
  STATUS_BUBBLE_LABELS,
  STATUS_CHIP_LABELS,
} from '../lib/friendsRepo';
import { useAppStore } from '../store/useAppStore';
import type { Building, FriendStatus } from '../types';
import { AddFriendModal } from './AddFriendModal';
import { PrivacyConsentModal } from './PrivacyConsentModal';

interface FriendsPanelProps {
  buildings: Building[];
  onFocusFriend?: (userId: string) => void;
  variant?: 'mobile' | 'sidebar';
}

const STATUS_OPTIONS: Exclude<FriendStatus, null>[] = [
  'study_buddy',
  'lunch_buddy',
  'in_class',
];

function ToggleSwitch({
  checked,
  disabled = false,
  onChange,
  label,
  accent = 'primary',
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
  accent?: 'primary' | 'orange';
}) {
  const activeBg = accent === 'orange' ? 'bg-accent' : 'bg-primary';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        disabled
          ? 'cursor-not-allowed bg-[#E2E7E5] opacity-60'
          : checked
            ? activeBg
            : 'bg-[#D5DDD9]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function FriendsPanel({
  buildings,
  onFocusFriend,
  variant = 'mobile',
}: FriendsPanelProps) {
  const friends = useAppStore((s) => s.friends);
  const pending = useAppStore((s) => s.pending);
  const myPresence = useAppStore((s) => s.myPresence);
  const visibleFriendIds = useAppStore((s) => s.visibleFriendIds);
  const shareConsentGiven = useAppStore((s) => s.shareConsentGiven);

  const setShareOn = useAppStore((s) => s.setShareOn);
  const grantShareConsent = useAppStore((s) => s.grantShareConsent);
  const setGhostMode = useAppStore((s) => s.setGhostMode);
  const setMyStatus = useAppStore((s) => s.setMyStatus);
  const setMyBuilding = useAppStore((s) => s.setMyBuilding);
  const toggleFriendVisibility = useAppStore((s) => s.toggleFriendVisibility);
  const clearMySocialData = useAppStore((s) => s.clearMySocialData);

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);

  const demo = isDemoMode();
  const buildingsById = new Map(buildings.map((b) => [b.id, b]));
  const myBuilding = myPresence.buildingId
    ? buildingsById.get(myPresence.buildingId) ?? null
    : null;
  const incomingCount = pending.filter((p) => p.direction === 'incoming').length;

  function handleToggleShare() {
    if (myPresence.shareOn) {
      setShareOn(false, demo);
      return;
    }
    if (!shareConsentGiven) {
      setShowPrivacyModal(true);
      return;
    }
    setShareOn(true, demo);
  }

  const content = (
    <div className="flex flex-col gap-3">
      {/* Header row inside sidebar (mobile uses mint header banner below) */}
      {variant === 'sidebar' && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink">Friends</h2>
            <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-[#156A4D]">
              Demo data
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddFriend(true)}
            className="relative inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-3.5 text-xs font-bold text-white transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UserPlus size={15} strokeWidth={1.8} />
            <span>Add friend</span>
            {incomingCount > 0 && (
              <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                {incomingCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Active Ghost Mode Banner */}
      {myPresence.ghost && (
        <div className="flex items-center gap-2.5 rounded-button bg-[#FFF3EB] px-3.5 py-2.5 text-xs font-semibold text-[#8C4A1C]">
          <EyeOff size={16} strokeWidth={1.8} className="shrink-0 text-accent" />
          <span>Ghost mode is on. You are hidden from everyone right now.</span>
        </div>
      )}

      {/* Share my location card */}
      <div className="rounded-card bg-white p-4 shadow-soft-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Radio
                size={15}
                strokeWidth={1.8}
                className={myPresence.shareOn ? 'text-primary' : 'text-muted'}
              />
              <p className="text-sm font-bold text-ink">Share my location</p>
            </div>
            <p className="mt-0.5 text-xs font-medium text-muted">
              Friends you accept can see which building you are in
            </p>
            {myPresence.shareOn && (
              <p className="mt-1 text-xs font-semibold text-[#156A4D]">
                {demo
                  ? 'Active • auto stops in 60s (demo mode)'
                  : 'Active • auto stops after 2 hours'}
              </p>
            )}
          </div>
          <ToggleSwitch
            checked={myPresence.shareOn}
            onChange={handleToggleShare}
            label="Share my location"
          />
        </div>
      </div>

      {/* Ghost mode card */}
      <div className="rounded-card bg-white p-4 shadow-soft-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <EyeOff
                size={15}
                strokeWidth={1.8}
                className={myPresence.ghost ? 'text-accent' : 'text-muted'}
              />
              <p className="text-sm font-bold text-ink">Ghost mode</p>
            </div>
            <p className="mt-0.5 text-xs font-medium text-muted">
              Hide yourself from everyone right now
            </p>
          </div>
          <ToggleSwitch
            checked={myPresence.ghost}
            onChange={() => setGhostMode(!myPresence.ghost)}
            label="Ghost mode"
            accent="orange"
          />
        </div>
      </div>

      {/* My status chips card */}
      <div className="rounded-card bg-white p-4 shadow-soft-sm">
        <div className="flex items-center gap-1.5">
          <Sparkles size={15} strokeWidth={1.8} className="text-primary" />
          <p className="text-sm font-bold text-ink">My status</p>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((statusKey) => {
            const isActive = myPresence.status === statusKey;
            return (
              <button
                key={statusKey}
                type="button"
                aria-pressed={isActive}
                onClick={() => setMyStatus(statusKey)}
                className={`min-h-[44px] rounded-full px-3.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-sm ${
                  isActive
                    ? 'bg-primary text-white shadow-soft-sm'
                    : 'bg-[#EEF1F0] text-ink hover:bg-mint/60'
                }`}
              >
                {STATUS_CHIP_LABELS[statusKey]}
              </button>
            );
          })}
        </div>
      </div>

      {/* My building card */}
      <div className="rounded-card bg-white p-4 shadow-soft-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Building2
              size={16}
              strokeWidth={1.8}
              className="shrink-0 text-primary"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted">My building</p>
              <p className="truncate text-sm font-bold text-ink">
                {myBuilding ? myBuilding.name : 'On campus'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBuildingPicker((prev) => !prev)}
            className="min-h-[44px] shrink-0 rounded-full px-3 text-xs font-bold text-[#156A4D] transition-colors hover:bg-mint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {showBuildingPicker ? 'Done' : 'Change'}
          </button>
        </div>

        {showBuildingPicker && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#EEF1F0] pt-3">
            <button
              type="button"
              onClick={() => {
                setMyBuilding(null, true);
                setShowBuildingPicker(false);
              }}
              className={`min-h-[44px] rounded-full px-3 text-xs font-bold transition-colors ${
                myPresence.buildingId === null
                  ? 'bg-primary text-white'
                  : 'bg-[#EEF1F0] text-ink hover:bg-mint/50'
              }`}
            >
              On campus
            </button>
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setMyBuilding(b.id, true);
                  setShowBuildingPicker(false);
                }}
                className={`min-h-[44px] rounded-full px-3 text-xs font-bold transition-colors ${
                  myPresence.buildingId === b.id
                    ? 'bg-primary text-white'
                    : 'bg-[#EEF1F0] text-ink hover:bg-mint/50'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Campus friends list */}
      <div className="rounded-card bg-white p-4 shadow-soft-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-ink">
            Campus friends ({friends.length})
          </p>
          <span className="text-xs font-medium text-muted">Show on map</span>
        </div>

        <ul className="flex flex-col gap-2.5">
          {friends.map((friend) => {
            const { user, presence } = friend;
            const isSharing = presence.shareOn && !presence.ghost;
            const isVisibleSwitchOn =
              isSharing && visibleFriendIds.includes(user.id);
            const friendBuilding = presence.buildingId
              ? buildingsById.get(presence.buildingId)
              : null;
            const statusText = presence.status
              ? STATUS_BUBBLE_LABELS[presence.status]
              : null;

            return (
              <li
                key={user.id}
                className="flex items-center justify-between gap-2.5 rounded-button bg-[#F7FAF9] p-2.5"
              >
                <button
                  type="button"
                  disabled={!isVisibleSwitchOn || !onFocusFriend}
                  onClick={() => onFocusFriend?.(user.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 text-left ${
                    isVisibleSwitchOn && onFocusFriend
                      ? 'cursor-pointer'
                      : 'cursor-default'
                  }`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.displayName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {user.displayName}
                    </p>
                    {isSharing ? (
                      <p className="truncate text-xs font-medium text-muted">
                        {statusText ? `${statusText} • ` : ''}
                        {friendBuilding ? friendBuilding.name : 'On campus'}
                      </p>
                    ) : (
                      <p className="truncate text-xs font-medium text-muted">
                        Not sharing location
                      </p>
                    )}
                  </div>
                </button>

                <ToggleSwitch
                  checked={isVisibleSwitchOn}
                  disabled={!isSharing}
                  onChange={() => toggleFriendVisibility(user.id)}
                  label={`Show ${user.displayName} on map`}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Stop sharing & clear data button */}
      <button
        type="button"
        onClick={clearMySocialData}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button bg-[#FFF3EB] px-4 py-2.5 text-xs font-bold text-[#B54B14] transition-colors hover:bg-[#FFE6D6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:text-sm"
      >
        <Trash2 size={15} strokeWidth={1.8} />
        <span>Stop sharing and clear my data</span>
      </button>

      {/* Modals */}
      <PrivacyConsentModal
        isOpen={showPrivacyModal}
        demoMode={demo}
        onAllow={() => {
          setShowPrivacyModal(false);
          grantShareConsent(demo);
        }}
        onDecline={() => setShowPrivacyModal(false)}
      />

      <AddFriendModal
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
      />
    </div>
  );

  if (variant === 'sidebar') {
    return content;
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#F5FAF8]">
      <header
        className="shrink-0 bg-mint px-4 pb-4 pt-12"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">Friends</h1>
            <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-[#156A4D]">
              Demo data
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddFriend(true)}
            className="relative inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-3.5 text-xs font-bold text-white shadow-soft-sm"
          >
            <UserPlus size={15} strokeWidth={1.8} />
            <span>Add friend</span>
            {incomingCount > 0 && (
              <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                {incomingCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">{content}</div>
    </div>
  );
}

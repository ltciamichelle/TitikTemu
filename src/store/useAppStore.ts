import { create } from 'zustand';
import { DEMO_USER_POSITION } from '../lib/constants';
import {
  applyAutoStop,
  friendsRepo,
  getShareDurationMs,
  loadShareConsent,
  MY_USER_ID,
  saveShareConsent,
} from '../lib/friendsRepo';
import { routeFromUser, type RouteResult } from '../lib/routing';
import type {
  AppTab,
  FriendRecord,
  FriendStatus,
  LngLat,
  PendingRequestRecord,
  Presence,
  SendRequestResult,
} from '../types';

export type RouteStatus = 'idle' | 'active' | 'no_path';
export type MapMode = '2d' | '3d';

interface AppState {
  // Map / Building / Route state
  selectedBuildingId: string | null;
  selectedFloor: string;
  searchQuery: string;
  activeTab: AppTab;
  mapMode: MapMode;
  userPosition: LngLat;
  route: RouteResult | null;
  routeStatus: RouteStatus;

  // Friends & Privacy state
  friends: FriendRecord[];
  pending: PendingRequestRecord[];
  myPresence: Presence;
  visibleFriendIds: string[];
  shareConsentGiven: boolean;
  selectedFriendId: string | null;
  manualBuildingOverride: boolean;

  // Map / Building / Route actions
  selectBuilding: (id: string | null, initialFloor?: string) => void;
  setFloor: (floor: string) => void;
  clearSelection: () => void;
  setQuery: (q: string) => void;
  setTab: (t: AppTab) => void;
  setMapMode: (mode: MapMode) => void;
  setUserPosition: (pos: LngLat) => void;
  startRoute: (buildingId: string) => void;
  endRoute: () => void;

  // Friends & Privacy actions
  setShareOn: (on: boolean, demoMode?: boolean) => void;
  grantShareConsent: (demoMode?: boolean) => void;
  setGhostMode: (ghost: boolean) => void;
  setMyStatus: (status: FriendStatus) => void;
  setMyBuilding: (buildingId: string | null, isManual?: boolean) => void;
  toggleFriendVisibility: (userId: string) => void;
  sendFriendRequest: (username: string) => SendRequestResult;
  acceptFriendRequest: (userId: string) => void;
  selectFriend: (userId: string | null) => void;
  checkAutoStop: (now?: number) => boolean;
  clearMySocialData: () => void;
  moveDemoFriend: (buildingIds: string[]) => void;
}

const initialFriends = friendsRepo.getFriends();
const initialPending = friendsRepo.getPending();
const initialMyPresence: Presence = friendsRepo.getPresence(MY_USER_ID) ?? {
  userId: MY_USER_ID,
  buildingId: null,
  status: null,
  shareOn: false,
  ghost: false,
  updatedAt: Date.now(),
  expiresAt: null,
};
// Enable currently-sharing seeded friends by default so demo pins appear on map
const initialVisibleFriendIds = initialFriends
  .filter((f) => f.presence.shareOn)
  .map((f) => f.user.id);

export const useAppStore = create<AppState>((set, get) => ({
  selectedBuildingId: null,
  selectedFloor: '1',
  searchQuery: '',
  activeTab: 'map',
  mapMode: '2d',
  userPosition: DEMO_USER_POSITION,
  route: null,
  routeStatus: 'idle',

  friends: initialFriends,
  pending: initialPending,
  myPresence: initialMyPresence,
  visibleFriendIds: initialVisibleFriendIds,
  shareConsentGiven: loadShareConsent(),
  selectedFriendId: null,
  manualBuildingOverride: false,

  selectBuilding: (id, initialFloor = '1') =>
    set({
      selectedBuildingId: id,
      selectedFloor: initialFloor,
      selectedFriendId: null,
      route: null,
      routeStatus: 'idle',
    }),
  setFloor: (floor) => set({ selectedFloor: floor }),
  clearSelection: () =>
    set({
      selectedBuildingId: null,
      selectedFloor: '1',
      selectedFriendId: null,
      route: null,
      routeStatus: 'idle',
    }),
  setQuery: (q) => set({ searchQuery: q }),
  setTab: (t) => set({ activeTab: t }),
  setMapMode: (mode) => set({ mapMode: mode }),
  setUserPosition: (pos) => set({ userPosition: pos }),
  startRoute: (buildingId) => {
    const { userPosition } = get();
    const result = routeFromUser(userPosition, buildingId);
    if (result) {
      set({
        selectedBuildingId: buildingId,
        selectedFriendId: null,
        route: result,
        routeStatus: 'active',
      });
    } else {
      set({
        selectedBuildingId: buildingId,
        selectedFriendId: null,
        route: null,
        routeStatus: 'no_path',
      });
    }
  },
  endRoute: () =>
    set({
      route: null,
      routeStatus: 'idle',
    }),

  setShareOn: (on, demoMode) => {
    const now = Date.now();
    const duration = getShareDurationMs(demoMode);
    const updated = friendsRepo.setMyPresence({
      shareOn: on,
      expiresAt: on ? now + duration : null,
      updatedAt: now,
    });
    set({ myPresence: updated });
  },

  grantShareConsent: (demoMode) => {
    saveShareConsent(true);
    const now = Date.now();
    const duration = getShareDurationMs(demoMode);
    const updated = friendsRepo.setMyPresence({
      shareOn: true,
      expiresAt: now + duration,
      updatedAt: now,
    });
    set({ shareConsentGiven: true, myPresence: updated });
  },

  setGhostMode: (ghost) => {
    const updated = friendsRepo.setMyPresence({
      ghost,
      updatedAt: Date.now(),
    });
    set({ myPresence: updated });
  },

  setMyStatus: (status) => {
    const current = get().myPresence.status;
    const nextStatus = current === status ? null : status;
    const updated = friendsRepo.setMyPresence({
      status: nextStatus,
      updatedAt: Date.now(),
    });
    set({ myPresence: updated });
  },

  setMyBuilding: (buildingId, isManual = false) => {
    const updated = friendsRepo.setMyPresence({
      buildingId,
      updatedAt: Date.now(),
    });
    set({
      myPresence: updated,
      manualBuildingOverride: isManual,
    });
  },

  toggleFriendVisibility: (userId) => {
    const current = get().visibleFriendIds;
    const exists = current.includes(userId);
    const next = exists
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    set({
      visibleFriendIds: next,
      selectedFriendId:
        exists && get().selectedFriendId === userId
          ? null
          : get().selectedFriendId,
    });
  },

  sendFriendRequest: (username) => {
    const result = friendsRepo.sendRequest(username);
    if (result.ok) {
      set({ pending: friendsRepo.getPending() });
    }
    return result;
  },

  acceptFriendRequest: (userId) => {
    const accepted = friendsRepo.acceptRequest(userId);
    if (!accepted) return;
    const nextVisible = accepted.presence.shareOn
      ? Array.from(new Set([...get().visibleFriendIds, accepted.user.id]))
      : get().visibleFriendIds;
    set({
      friends: friendsRepo.getFriends(),
      pending: friendsRepo.getPending(),
      visibleFriendIds: nextVisible,
    });
  },

  selectFriend: (userId) =>
    set({
      selectedFriendId: userId,
      selectedBuildingId: userId ? null : get().selectedBuildingId,
      route: userId ? null : get().route,
      routeStatus: userId ? 'idle' : get().routeStatus,
    }),

  checkAutoStop: (now = Date.now()) => {
    const { myPresence } = get();
    const { stopped } = applyAutoStop(myPresence, now);
    if (stopped) {
      const saved = friendsRepo.setMyPresence({
        shareOn: false,
        expiresAt: null,
        updatedAt: now,
      });
      set({ myPresence: saved });
      return true;
    }
    return false;
  },

  clearMySocialData: () => {
    const cleared = friendsRepo.clearMyData();
    set({
      myPresence: cleared,
      visibleFriendIds: [],
      selectedFriendId: null,
      manualBuildingOverride: false,
    });
  },

  moveDemoFriend: (buildingIds) => {
    if (!friendsRepo.moveDemoFriend) return;
    const moved = friendsRepo.moveDemoFriend(buildingIds);
    if (moved) {
      set({ friends: friendsRepo.getFriends() });
    }
  },
}));

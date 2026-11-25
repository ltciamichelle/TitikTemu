import { create } from 'zustand';
import { authRepo, type DemoAuthUser } from '../lib/authRepo';
import {
  DEMO_USER_POSITION,
  ENABLE_ILLUSTRATED,
  ENABLE_NAV3D,
} from '../lib/constants';
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
export type CameraMode = '2d' | 'overview3d' | 'nav3d';
export type PositionSource = 'sim' | 'gps';
export type SimSpeed = 1 | 3 | 6;
export type VisualStyle = 'flat' | 'illustrated';

interface AppState {
  // Dummy Auth / Onboarding state (replace with Supabase Auth later)
  authUser: DemoAuthUser | null;

  // Map / Building / Route state
  selectedBuildingId: string | null;
  selectedFloor: string;
  searchQuery: string;
  activeTab: AppTab;
  mapMode: MapMode;
  cameraMode: CameraMode;
  visualStyle: VisualStyle;
  followPaused: boolean;
  positionSource: PositionSource;
  distanceAlongM: number;
  simSpeed: SimSpeed;
  simPlaying: boolean;
  hasArrived: boolean;
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

  // Dummy Auth actions
  signUpDemo: (input: {
    displayName: string;
    username: string;
    email: string;
  }) => void;
  logInDemo: (identifier: string) => void;
  continueAsVisitor: () => void;
  signOutDemo: () => void;

  // Map / Building / Route actions
  selectBuilding: (id: string | null, initialFloor?: string) => void;
  setFloor: (floor: string) => void;
  clearSelection: () => void;
  setQuery: (q: string) => void;
  setTab: (t: AppTab) => void;
  setMapMode: (mode: MapMode) => void;
  setCameraMode: (mode: CameraMode) => void;
  setVisualStyle: (style: VisualStyle) => void;
  setFollowPaused: (paused: boolean) => void;
  setPositionSource: (source: PositionSource) => void;
  setDistanceAlongM: (dist: number) => void;
  setSimSpeed: (speed: SimSpeed) => void;
  setSimPlaying: (playing: boolean) => void;
  setHasArrived: (arrived: boolean) => void;
  setUserPosition: (pos: LngLat) => void;
  startRoute: (buildingId: string) => void;
  enterNav3D: () => void;
  recomputeRouteFrom: (origin: LngLat) => boolean;
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
const initialVisibleFriendIds = initialFriends
  .filter((f) => f.presence.shareOn)
  .map((f) => f.user.id);

export const useAppStore = create<AppState>((set, get) => ({
  authUser: authRepo.getCurrentUser(),

  selectedBuildingId: null,
  selectedFloor: '1',
  searchQuery: '',
  activeTab: 'map',
  mapMode: '2d',
  cameraMode: '2d',
  visualStyle: ENABLE_ILLUSTRATED ? 'illustrated' : 'flat',
  followPaused: false,
  positionSource: 'sim',
  distanceAlongM: 0,
  simSpeed: 1,
  simPlaying: false,
  hasArrived: false,
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

  signUpDemo: (input) => {
    const user = authRepo.signUp(input);
    set({ authUser: user });
  },
  logInDemo: (identifier) => {
    const user = authRepo.logIn(identifier);
    set({ authUser: user });
  },
  continueAsVisitor: () => {
    const user = authRepo.continueAsVisitor();
    set({ authUser: user });
  },
  signOutDemo: () => {
    authRepo.signOut();
    set({ authUser: null });
  },

  selectBuilding: (id, initialFloor = '1') => {
    const prevCam = get().cameraMode;
    set({
      selectedBuildingId: id,
      selectedFloor: initialFloor,
      selectedFriendId: null,
      route: null,
      routeStatus: 'idle',
      distanceAlongM: 0,
      simPlaying: false,
      hasArrived: false,
      followPaused: false,
      cameraMode: prevCam === 'nav3d' ? 'overview3d' : prevCam,
      mapMode: prevCam === '2d' ? '2d' : '3d',
    });
  },
  setFloor: (floor) => set({ selectedFloor: floor }),
  clearSelection: () => {
    const prevCam = get().cameraMode;
    set({
      selectedBuildingId: null,
      selectedFloor: '1',
      selectedFriendId: null,
      route: null,
      routeStatus: 'idle',
      distanceAlongM: 0,
      simPlaying: false,
      hasArrived: false,
      followPaused: false,
      cameraMode: prevCam === 'nav3d' ? 'overview3d' : prevCam,
      mapMode: prevCam === '2d' ? '2d' : '3d',
    });
  },
  setQuery: (q) => set({ searchQuery: q }),
  setTab: (t) => set({ activeTab: t }),
  setMapMode: (mode) =>
    set({
      mapMode: mode,
      cameraMode: mode === '2d' ? '2d' : 'overview3d',
      followPaused: false,
    }),
  setCameraMode: (mode) =>
    set({
      cameraMode: mode,
      mapMode: mode === '2d' ? '2d' : '3d',
      followPaused: false,
    }),
  setVisualStyle: (style) => set({ visualStyle: style }),
  setFollowPaused: (paused) => set({ followPaused: paused }),
  setPositionSource: (source) =>
    set({
      positionSource: source,
      simPlaying: source === 'sim' ? get().simPlaying : false,
    }),
  setDistanceAlongM: (dist) => set({ distanceAlongM: dist }),
  setSimSpeed: (speed) => set({ simSpeed: speed }),
  setSimPlaying: (playing) => set({ simPlaying: playing }),
  setHasArrived: (arrived) =>
    set({
      hasArrived: arrived,
      simPlaying: arrived ? false : get().simPlaying,
    }),
  setUserPosition: (pos) => set({ userPosition: pos }),

  startRoute: (buildingId) => {
    const { userPosition, cameraMode } = get();
    const result = routeFromUser(userPosition, buildingId);
    if (result) {
      const autoNav3D =
        ENABLE_NAV3D && (cameraMode === 'overview3d' || cameraMode === 'nav3d');
      set({
        selectedBuildingId: buildingId,
        selectedFriendId: null,
        route: result,
        routeStatus: 'active',
        distanceAlongM: 0,
        hasArrived: false,
        followPaused: false,
        cameraMode: autoNav3D ? 'nav3d' : cameraMode,
        mapMode: autoNav3D ? '3d' : cameraMode === '2d' ? '2d' : '3d',
        simPlaying: autoNav3D,
      });
    } else {
      set({
        selectedBuildingId: buildingId,
        selectedFriendId: null,
        route: null,
        routeStatus: 'no_path',
        distanceAlongM: 0,
        simPlaying: false,
        hasArrived: false,
      });
    }
  },

  enterNav3D: () => {
    if (!ENABLE_NAV3D) return;
    const { routeStatus, positionSource } = get();
    if (routeStatus !== 'active') return;
    set({
      cameraMode: 'nav3d',
      mapMode: '3d',
      followPaused: false,
      hasArrived: false,
      simPlaying: positionSource === 'sim',
    });
  },

  recomputeRouteFrom: (origin) => {
    const { selectedBuildingId } = get();
    if (!selectedBuildingId) return false;
    const result = routeFromUser(origin, selectedBuildingId);
    if (!result) return false;
    set({
      userPosition: origin,
      route: result,
      routeStatus: 'active',
      distanceAlongM: 0,
      hasArrived: false,
      followPaused: false,
    });
    return true;
  },

  endRoute: () => {
    const prevCam = get().cameraMode;
    set({
      route: null,
      routeStatus: 'idle',
      distanceAlongM: 0,
      simPlaying: false,
      hasArrived: false,
      followPaused: false,
      cameraMode: prevCam === 'nav3d' ? 'overview3d' : prevCam,
      mapMode: prevCam === '2d' ? '2d' : '3d',
    });
  },

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

  selectFriend: (userId) => {
    const prevCam = get().cameraMode;
    set({
      selectedFriendId: userId,
      selectedBuildingId: userId ? null : get().selectedBuildingId,
      route: userId ? null : get().route,
      routeStatus: userId ? 'idle' : get().routeStatus,
      distanceAlongM: userId ? 0 : get().distanceAlongM,
      simPlaying: userId ? false : get().simPlaying,
      hasArrived: false,
      cameraMode: userId && prevCam === 'nav3d' ? 'overview3d' : prevCam,
    });
  },

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

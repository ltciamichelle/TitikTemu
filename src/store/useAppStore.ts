import { create } from 'zustand';
import { DEMO_USER_POSITION } from '../lib/constants';
import { routeFromUser, type RouteResult } from '../lib/routing';
import type { AppTab, LngLat } from '../types';

export type RouteStatus = 'idle' | 'active' | 'no_path';

interface AppState {
  selectedBuildingId: string | null;
  selectedFloor: string;
  searchQuery: string;
  activeTab: AppTab;
  userPosition: LngLat;
  route: RouteResult | null;
  routeStatus: RouteStatus;
  selectBuilding: (id: string | null, initialFloor?: string) => void;
  setFloor: (floor: string) => void;
  clearSelection: () => void;
  setQuery: (q: string) => void;
  setTab: (t: AppTab) => void;
  setUserPosition: (pos: LngLat) => void;
  startRoute: (buildingId: string) => void;
  endRoute: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedBuildingId: null,
  selectedFloor: '1',
  searchQuery: '',
  activeTab: 'map',
  userPosition: DEMO_USER_POSITION,
  route: null,
  routeStatus: 'idle',
  selectBuilding: (id, initialFloor = '1') =>
    set({
      selectedBuildingId: id,
      selectedFloor: initialFloor,
      route: null,
      routeStatus: 'idle',
    }),
  setFloor: (floor) => set({ selectedFloor: floor }),
  clearSelection: () =>
    set({
      selectedBuildingId: null,
      selectedFloor: '1',
      route: null,
      routeStatus: 'idle',
    }),
  setQuery: (q) => set({ searchQuery: q }),
  setTab: (t) => set({ activeTab: t }),
  setUserPosition: (pos) => set({ userPosition: pos }),
  startRoute: (buildingId) => {
    const { userPosition } = get();
    const result = routeFromUser(userPosition, buildingId);
    if (result) {
      set({
        selectedBuildingId: buildingId,
        route: result,
        routeStatus: 'active',
      });
    } else {
      set({
        selectedBuildingId: buildingId,
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
}));

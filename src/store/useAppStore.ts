import { create } from 'zustand';
import type { AppTab } from '../types';

interface AppState {
  selectedBuildingId: string | null;
  selectedFloor: number;
  searchQuery: string;
  activeTab: AppTab;
  selectBuilding: (id: string | null, initialFloor?: number) => void;
  setFloor: (floor: number) => void;
  clearSelection: () => void;
  setQuery: (q: string) => void;
  setTab: (t: AppTab) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedBuildingId: null,
  selectedFloor: 1,
  searchQuery: '',
  activeTab: 'map',
  selectBuilding: (id, initialFloor = 1) =>
    set({ selectedBuildingId: id, selectedFloor: initialFloor }),
  setFloor: (floor) => set({ selectedFloor: floor }),
  clearSelection: () => set({ selectedBuildingId: null, selectedFloor: 1 }),
  setQuery: (q) => set({ searchQuery: q }),
  setTab: (t) => set({ activeTab: t }),
}));

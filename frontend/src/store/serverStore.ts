import { create } from 'zustand';

interface ServerState {
  selectedServerId: number | null;
  isFleetMode: boolean;
  setSelectedServer: (id: number | null) => void;
  setFleetMode: (v: boolean) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  selectedServerId: null,
  isFleetMode: false,
  setSelectedServer: (id) => set({ selectedServerId: id }),
  setFleetMode: (v) => set({ isFleetMode: v }),
}));

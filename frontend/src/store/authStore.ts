import { create } from 'zustand';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  allowed_system_users: string[];
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  needsSetup: boolean;
  setUser: (user: AuthUser | null) => void;
  setNeedsSetup: (v: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  needsSetup: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setNeedsSetup: (v) => set({ needsSetup: v }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

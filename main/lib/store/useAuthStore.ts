import { create } from 'zustand';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

// AuthProvider fills this store from the live NextAuth session.
// Persisting it would restore a signed-in UI even after the session expires.
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
}));

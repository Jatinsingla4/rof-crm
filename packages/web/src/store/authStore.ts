import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  projectIds: string[];
}

interface AuthStore {
  user: User | null;
  token: string | null;
  permissions: string[];

  // Actions
  setAuth: (user: User, token: string, permissions: string[]) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
}

/**
 * Auth Store (Zustand)
 * Persists user session to localStorage
 * Minimal (3KB), no Redux boilerplate
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      permissions: [],

      setAuth: (user, token, permissions) => {
        set({ user, token, permissions });
        // Store token in Authorization header for API calls
        localStorage.setItem('auth_token', token);
      },

      logout: () => {
        set({ user: null, token: null, permissions: [] });
        localStorage.removeItem('auth_token');
      },

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        permissions: state.permissions,
      }),
    }
  )
);

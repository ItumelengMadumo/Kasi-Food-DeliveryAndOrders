import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setUser: (user: User | null) => void;
  setGuest: (guestDetails: { name: string; phone: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isGuest: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isGuest: false,
        }),

      setGuest: (guestDetails) =>
        set({
          user: {
            id: `guest_${Date.now()}`,
            name: guestDetails.name,
            phone: guestDetails.phone,
            role: 'CUSTOMER',
            isGuest: true,
            createdAt: new Date().toISOString(),
          },
          isAuthenticated: false,
          isGuest: true,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isGuest: false,
        }),
    }),
    {
      name: 'kasi-auth',
      partialize: (state) => ({ user: state.user, isGuest: state.isGuest }),
    }
  )
);

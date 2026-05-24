import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SkyforgeUser {
  id:                 string;
  email:              string;
  username:           string;
  role:               string;
  full_name:          string | null;
  unit:               string | null;
  avatar_url:         string | null;
  missions_completed: number;
  flight_hours:       number;
  is_verified:        boolean;
}

interface AuthState {
  user:         SkyforgeUser | null;
  accessToken:  string | null;
  refreshToken: string | null;
  isAuth:       boolean;
  setAuth:      (user: SkyforgeUser, access: string, refresh: string) => void;
  clearAuth:    () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isAuth:       false,

      setAuth: (user, access, refresh) =>
        set({ user, accessToken: access, refreshToken: refresh, isAuth: true }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuth: false }),
    }),
    {
      name:    "skyforge-auth",
      partialize: (s) => ({
        user:         s.user,
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
        isAuth:       s.isAuth,
      }),
    }
  )
);

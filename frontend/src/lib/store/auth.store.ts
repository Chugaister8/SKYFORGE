import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "@/lib/api";

export interface AuthUser {
  id:       string;
  username: string;
  email:    string;
  role:     string;
  status:   string;
}

interface AuthState {
  user:         AuthUser | null;
  accessToken:  string | null;
  refreshToken: string | null;
  expiresAt:    number | null;   // UTC ms

  setAuth:     (user: AuthUser, access: string, refresh: string, expiresIn: number) => void;
  clearAuth:   () => void;
  refreshAuth: () => Promise<boolean>;
  isExpired:   () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      expiresAt:    null,

      setAuth: (user, access, refresh, expiresIn) => {
        set({
          user,
          accessToken:  access,
          refreshToken: refresh,
          expiresAt:    Date.now() + expiresIn * 1000 - 60_000, // 1min buffer
        });
      },

      clearAuth: () => set({
        user: null, accessToken: null, refreshToken: null, expiresAt: null,
      }),

      isExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return true;
        return Date.now() > expiresAt;
      },

      refreshAuth: async () => {
        const { refreshToken, clearAuth, setAuth } = get();
        if (!refreshToken) { clearAuth(); return false; }
        try {
          const res = await api.post<{
            access_token: string; refresh_token: string; expires_in: number;
          }>("/auth/refresh", { refresh_token: refreshToken });

          const { user } = get();
          if (!user) { clearAuth(); return false; }

          setAuth(user, res.access_token, res.refresh_token, res.expires_in);
          return true;
        } catch {
          clearAuth();
          return false;
        }
      },
    }),
    {
      name:    "skyforge-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        user:         s.user,
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
        expiresAt:    s.expiresAt,
      }),
    },
  ),
);

// ── Auto-refresh interceptor ─────────────────────────────────────
// Transparently refresh token before expiry
let _refreshing = false;

export async function getValidToken(): Promise<string | null> {
  const store = useAuthStore.getState();
  if (!store.accessToken) return null;

  if (store.isExpired()) {
    if (_refreshing) {
      // Wait for ongoing refresh
      await new Promise(r => setTimeout(r, 500));
      return useAuthStore.getState().accessToken;
    }
    _refreshing = true;
    const ok = await store.refreshAuth();
    _refreshing = false;
    if (!ok) return null;
  }

  return useAuthStore.getState().accessToken;
}

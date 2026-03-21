import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  nickname: string;
}

interface UserStore {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setUser: (user: AuthUser | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  initialize: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      initialize: () => {
        const { user, accessToken } = get();
        set({ isAuthenticated: !!(user && accessToken) });
      },
    }),
    {
      name: "sweet-spicy-user",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);

const API_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
    : "http://localhost:3001";

export async function loginAsGuest(nickname: string): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nickname }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message ?? "Failed to login");
  }

  const json = await response.json();
  const { user, accessToken, refreshToken } = json.data;

  useUserStore.getState().setUser(user);
  useUserStore.getState().setTokens(accessToken, refreshToken);

  return user;
}

export async function refreshAccessToken(): Promise<string> {
  const { refreshToken } = useUserStore.getState();

  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    useUserStore.getState().logout();
    throw new Error("Failed to refresh token");
  }

  const data = await response.json();
  const { accessToken } = data.data;

  useUserStore.getState().setAccessToken(accessToken);

  return accessToken;
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  _id: string
  name: string
  email: string
  phone?: string
  profileImage?: string
  role: 'user' | 'admin'
  isActive: boolean
  createdAt: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  error: string | null

  // Actions
  setUser: (user: User | null) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setAccessToken: (accessToken: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          error: null,
        }),
      reset: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

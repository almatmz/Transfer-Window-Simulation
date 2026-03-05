import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setTokens: (access: string, refresh: string, role: UserRole) => void
  setUser: (user: User) => void
  logout: () => void
  isRole: (role: UserRole) => boolean
  isSportDirector: () => boolean
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setTokens: (access, refresh) => {
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        set({ accessToken: access, refreshToken: refresh })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, refreshToken: null })
      },
      isRole: (role) => {
        const hierarchy = ['user', 'sport_director', 'admin']
        const userRole = get().user?.role || 'user'
        return hierarchy.indexOf(userRole) >= hierarchy.indexOf(role)
      },
      isSportDirector: () => get().isRole('sport_director'),
      isAdmin: () => get().isRole('admin'),
    }),
    { name: 'auth-store', partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
)

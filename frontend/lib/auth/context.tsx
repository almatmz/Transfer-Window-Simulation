'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, setTokens, clearTokens, getAccessToken } from '@/lib/api/client';
import type { UserResponse } from '@/lib/api/client';

interface AuthState {
  user: UserResponse | null;
  loading: boolean;
  isAuthenticated: boolean;
  role: string;
}
interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, full_name?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (u: UserResponse) => void;
}

const AuthContext = createContext<AuthState & AuthActions>({
  user: null, loading: true, isAuthenticated: false, role: 'anonymous',
  login: async () => {}, register: async () => {}, logout: () => {},
  refreshUser: async () => {}, updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }
    try { const u = await authApi.me(); setUser(u); }
    catch { clearTokens(); setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setTokens(res.access_token, res.refresh_token);
    const u = await authApi.me();
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, full_name = '') => {
    const res = await authApi.register({ email, username, password, full_name });
    setTokens(res.access_token, res.refresh_token);
    const u = await authApi.me();
    setUser(u);
  }, []);

  const logout = useCallback(() => { clearTokens(); setUser(null); }, []);
  const updateUser = useCallback((u: UserResponse) => setUser(u), []);

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated: !!user, role: user?.role ?? 'anonymous',
      login, register, logout, refreshUser, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }

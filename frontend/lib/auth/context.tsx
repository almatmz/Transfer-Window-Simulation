'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, setTokens, clearTokens, getAccessToken } from '@/lib/api/client';
import type { UserResponse, TokenResponse } from '@/lib/api/types';

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
}

const AuthContext = createContext<AuthState & AuthActions>({
  user: null,
  loading: true,
  isAuthenticated: false,
  role: 'anonymous',
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }
    try {
      const u = await authApi.me();
      setUser(u);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const handleTokenResponse = useCallback((res: TokenResponse) => {
    setTokens(res.access_token, res.refresh_token);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    handleTokenResponse(res);
    const u = await authApi.me();
    setUser(u);
  }, [handleTokenResponse]);

  const register = useCallback(async (email: string, username: string, password: string, full_name = '') => {
    const res = await authApi.register({ email, username, password, full_name });
    handleTokenResponse(res);
    const u = await authApi.me();
    setUser(u);
  }, [handleTokenResponse]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      role: user?.role ?? 'anonymous',
      login,
      register,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireAuth() {
  const auth = useAuth();
  return auth;
}

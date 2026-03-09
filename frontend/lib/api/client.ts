import type {
  TokenResponse,
  ApiError,
  ClubSearchResult,
  ClubResponse,
  ClubRevenueUpdate,
  UserResponse,
  UserUpdateRequest,
  AdminUserUpdateRequest,
  RegisterRequest,
  LoginRequest,
  SalaryOverrideRequest,
  SalaryOverrideResponse,
  SimulationCreateRequest,
  SimulationResponse,
  SimulationSummary,
  UpdateSimulationMetaRequest,
  AddBuyRequest,
  AddSellRequest,
  AddLoanInRequest,
  AddLoanOutRequest,
  FFPDashboardResponse,
  WindowType,
  PlayerData,
} from './types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || 'http://localhost:8000';

// Token storage — memory + sessionStorage fallback (not localStorage)
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<boolean> | null = null;

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('_at', access);
      sessionStorage.setItem('_rt', refresh);
    } catch {}
  }
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('_at');
      sessionStorage.removeItem('_rt');
    } catch {}
  }
}

export function loadTokensFromSession() {
  if (typeof window !== 'undefined') {
    try {
      _accessToken = sessionStorage.getItem('_at');
      _refreshToken = sessionStorage.getItem('_rt');
    } catch {}
  }
}

export function getAccessToken() {
  if (!_accessToken && typeof window !== 'undefined') {
    try { _accessToken = sessionStorage.getItem('_at'); } catch {}
  }
  return _accessToken;
}

export function getRefreshToken() {
  if (!_refreshToken && typeof window !== 'undefined') {
    try { _refreshToken = sessionStorage.getItem('_rt'); } catch {}
  }
  return _refreshToken;
}

export function isAuthenticated() {
  return !!getAccessToken();
}

// Internal fetch with auto-refresh
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshed = await doRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, false);
    } else {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body: ApiError = await res.json();
      if (typeof body.detail === 'string') errMsg = body.detail;
      else if (Array.isArray(body.detail)) errMsg = body.detail.map(e => e.msg).join(', ');
    } catch {}
    throw new Error(errMsg);
  }

  // Handle empty body
  const text = await res.text();
  if (!text || text === 'null') return {} as T;
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

async function doRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${BACKEND}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const data: TokenResponse = await res.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch { return false; }
    finally { _refreshPromise = null; }
  })();
  return _refreshPromise;
}

// ============================================================
// AUTH
// ============================================================
export const authApi = {
  register: (body: RegisterRequest) =>
    apiFetch<TokenResponse>('/api/v1/auth/register', {
      method: 'POST', body: JSON.stringify(body),
    }),

  login: (body: LoginRequest) =>
    apiFetch<TokenResponse>('/api/v1/auth/login', {
      method: 'POST', body: JSON.stringify(body),
    }),

  refresh: (refresh_token: string) =>
    apiFetch<TokenResponse>('/api/v1/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refresh_token }),
    }),

  me: () => apiFetch<UserResponse>('/api/v1/auth/me'),

  updateMe: (body: UserUpdateRequest) =>
    apiFetch<UserResponse>('/api/v1/auth/me', {
      method: 'PATCH', body: JSON.stringify(body),
    }),
};

// ============================================================
// SEARCH
// ============================================================
export const searchApi = {
  clubs: (q: string, country = '') => {
    const params = new URLSearchParams({ q });
    if (country) params.set('country', country);
    return apiFetch<ClubSearchResult[]>(`/api/v1/search/clubs?${params}`);
  },
};

// ============================================================
// CLUBS
// ============================================================
export const clubsApi = {
  get: (id: number, season = 2024) =>
    apiFetch<ClubResponse>(`/api/v1/clubs/${id}?season=${season}`),

  squad: (id: number) =>
    apiFetch<unknown>(`/api/v1/clubs/${id}/squad`),

  setRevenue: (id: number, body: ClubRevenueUpdate) =>
    apiFetch<ClubResponse>(`/api/v1/clubs/${id}/revenue`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  sync: (id: number, season = 2024) =>
    apiFetch<unknown>(`/api/v1/clubs/${id}/sync?season=${season}`, { method: 'POST' }),
};

// ============================================================
// PLAYERS
// ============================================================
export const playersApi = {
  get: (id: number) =>
    apiFetch<PlayerData>(`/api/v1/players/${id}`),

  setSalaryOverride: (id: number, body: SalaryOverrideRequest) =>
    apiFetch<SalaryOverrideResponse>(`/api/v1/players/${id}/salary-override`, {
      method: 'PUT', body: JSON.stringify(body),
    }),

  deleteSalaryOverride: (id: number) =>
    apiFetch<unknown>(`/api/v1/players/${id}/salary-override`, { method: 'DELETE' }),
};

// ============================================================
// FFP
// ============================================================
export const ffpApi = {
  dashboard: (clubId: number, simId?: string | null) => {
    const params = new URLSearchParams();
    if (simId) params.set('sim_id', simId);
    const qs = params.toString();
    return apiFetch<FFPDashboardResponse>(`/api/v1/ffp/club/${clubId}${qs ? '?' + qs : ''}`);
  },
};

// ============================================================
// SIMULATIONS
// ============================================================
export const simulationsApi = {
  create: (body: SimulationCreateRequest) =>
    apiFetch<SimulationResponse>('/api/v1/simulations/', {
      method: 'POST', body: JSON.stringify(body),
    }),

  listMy: (season?: string | null, window_type?: WindowType | null) => {
    const params = new URLSearchParams();
    if (season) params.set('season', season);
    if (window_type) params.set('window_type', window_type);
    const qs = params.toString();
    return apiFetch<SimulationSummary[]>(`/api/v1/simulations/my${qs ? '?' + qs : ''}`);
  },

  get: (id: string) => apiFetch<SimulationResponse>(`/api/v1/simulations/${id}`),

  updateMeta: (id: string, body: UpdateSimulationMetaRequest) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    apiFetch<unknown>(`/api/v1/simulations/${id}`, { method: 'DELETE' }),

  addBuy: (id: string, body: AddBuyRequest) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}/buys`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  removeBuy: (id: string, index: number) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}/buys/${index}`, { method: 'DELETE' }),

  addSell: (id: string, body: AddSellRequest) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}/sells`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  removeSell: (id: string, index: number) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}/sells/${index}`, { method: 'DELETE' }),

  addLoanIn: (id: string, body: AddLoanInRequest) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}/loans-in`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  removeLoanIn: (id: string, index: number) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}/loans-in/${index}`, { method: 'DELETE' }),

  addLoanOut: (id: string, body: AddLoanOutRequest) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}/loans-out`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  removeLoanOut: (id: string, index: number) =>
    apiFetch<SimulationResponse>(`/api/v1/simulations/${id}/loans-out/${index}`, { method: 'DELETE' }),
};

// ============================================================
// ADMIN
// ============================================================
export const adminApi = {
  listUsers: () => apiFetch<UserResponse[]>('/api/v1/admin/users'),
  updateUser: (id: string, body: AdminUserUpdateRequest) =>
    apiFetch<UserResponse>(`/api/v1/admin/users/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),
};

import type {
  TokenResponse,
  UserResponse,
  ClubSearchResult,
  ClubResponse,
  SquadResponse,
  PlayerData,
  PlayerOverrideRequest,
  PlayerOverrideResponse,
  LoanDealRequest,
  LoanDealResponse,
  ContractExtensionRequest,
  ContractExtensionResponse,
  SquadOverrideCreateRequest,
  SquadOverrideResponse,
  SimulationCreateRequest,
  UpdateSimulationMetaRequest,
  SimulationResponse,
  SimulationSummary,
  AddBuyRequest,
  AddSellRequest,
  AddLoanInRequest,
  AddLoanOutRequest,
  FFPDashboardResponse,
} from "./types";

export * from "./types";

const BASE = `${process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://localhost:8000"}/api/v1`;

export const CURRENT_SEASON =
  new Date().getMonth() >= 6
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;

//  Token storage (memory + sessionStorage)
let _at: string | null = null;
let _rt: string | null = null;
let _refreshing: Promise<boolean> | null = null;

export const setTokens = (a: string, r: string) => {
  _at = a;
  _rt = r;
  try {
    sessionStorage.setItem("_at", a);
    sessionStorage.setItem("_rt", r);
  } catch {}
};
export const clearTokens = () => {
  _at = null;
  _rt = null;
  try {
    sessionStorage.removeItem("_at");
    sessionStorage.removeItem("_rt");
  } catch {}
};
export const getAccessToken = (): string | null => {
  if (!_at)
    try {
      _at = sessionStorage.getItem("_at");
    } catch {}
  return _at;
};
export const getRefreshToken = (): string | null => {
  if (!_rt)
    try {
      _rt = sessionStorage.getItem("_rt");
    } catch {}
  return _rt;
};
export const isAuthenticated = () => !!getAccessToken();

//  Core fetch with auto-refresh
async function tryRefresh(): Promise<boolean> {
  if (_refreshing) return _refreshing;
  return (_refreshing = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const d = await res.json();
      setTokens(d.access_token, d.refresh_token);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      _refreshing = null;
    }
  })());
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  if (res.status === 401 && retry) {
    if (await tryRefresh()) return apiFetch<T>(path, init, false);
    clearTokens();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      msg =
        typeof b.detail === "string"
          ? b.detail
          : Array.isArray(b.detail)
            ? b.detail.map((e: any) => e.msg).join(", ")
            : msg;
    } catch {}
    throw new Error(msg);
  }
  const text = await res.text();
  if (!text || text === "null") return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

//  Auth
export const authApi = {
  register: (b: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
  }) =>
    apiFetch<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  login: (b: { email: string; password: string }) =>
    apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  me: () => apiFetch<UserResponse>("/auth/me"),
  updateMe: (
    b: Partial<
      Pick<UserResponse, "full_name" | "username" | "club_affiliation">
    >,
  ) =>
    apiFetch<UserResponse>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
};

//  Search
export const searchApi = {
  clubs: (q: string, country = "") =>
    apiFetch<ClubSearchResult[]>(
      `/search/clubs?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`,
    ),
};

//  Clubs
export const clubsApi = {
  get: (id: number, season = CURRENT_SEASON) =>
    apiFetch<ClubResponse>(`/clubs/${id}?season=${season}`),
  squad: (id: number, viewSeason = CURRENT_SEASON) =>
    apiFetch<SquadResponse>(`/clubs/${id}/squad?view_season=${viewSeason}`),
  setRevenue: (
    id: number,
    b: { annual_revenue: number; season_year: number },
  ) =>
    apiFetch<ClubResponse>(`/clubs/${id}/revenue`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  sync: (id: number) => apiFetch<any>(`/clubs/${id}/sync`, { method: "POST" }),
};

//  Players
export const playersApi = {
  get: (id: number) => apiFetch<PlayerData>(`/players/${id}`),
  setOverride: (id: number, b: PlayerOverrideRequest) =>
    apiFetch<PlayerOverrideResponse>(`/players/${id}/override`, {
      method: "PUT",
      body: JSON.stringify(b),
    }),
  deleteOverride: (id: number) =>
    apiFetch<void>(`/players/${id}/override`, { method: "DELETE" }),
  listOverrides: (id: number) =>
    apiFetch<PlayerOverrideResponse[]>(`/players/${id}/overrides`),
  getLoan: (id: number) =>
    apiFetch<LoanDealResponse | LoanDealResponse[]>(`/players/${id}/loan`),
  setLoan: (id: number, b: LoanDealRequest) =>
    apiFetch<LoanDealResponse>(`/players/${id}/loan`, {
      method: "PUT",
      body: JSON.stringify(b),
    }),
  deleteLoan: (id: number, dir: "in" | "out") =>
    apiFetch<void>(`/players/${id}/loan/${dir}`, { method: "DELETE" }),
  exerciseOption: (id: number, dir: "in" | "out", notes = "") =>
    apiFetch<LoanDealResponse>(`/players/${id}/loan/${dir}/exercise-option`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
  getContractExt: (id: number) =>
    apiFetch<ContractExtensionResponse[]>(`/players/${id}/contract-extension`),
  setContractExt: (id: number, b: ContractExtensionRequest) =>
    apiFetch<ContractExtensionResponse>(`/players/${id}/contract-extension`, {
      method: "PUT",
      body: JSON.stringify(b),
    }),
  deleteContractExt: (id: number) =>
    apiFetch<void>(`/players/${id}/contract-extension`, { method: "DELETE" }),
};

//  Squad Overrides
export const squadOverridesApi = {
  list: (clubId: number) =>
    apiFetch<SquadOverrideResponse[]>(`/squad-overrides/clubs/${clubId}`),
  create: (clubId: number, b: SquadOverrideCreateRequest) =>
    apiFetch<SquadOverrideResponse>(`/squad-overrides/clubs/${clubId}`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  delete: (id: string) =>
    apiFetch<void>(`/squad-overrides/${id}`, { method: "DELETE" }),
  effective: (clubId: number, season = CURRENT_SEASON) =>
    apiFetch<SquadResponse>(
      `/squad-overrides/clubs/${clubId}/effective?season_year=${season}`,
    ),
};

//  Simulations
export const simulationsApi = {
  create: (b: SimulationCreateRequest) =>
    apiFetch<SimulationResponse>("/simulations/", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  listMy: () => apiFetch<SimulationSummary[]>("/simulations/my"),
  get: (id: string) => apiFetch<SimulationResponse>(`/simulations/${id}`),
  update: (id: string, b: Partial<UpdateSimulationMetaRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  delete: (id: string) =>
    apiFetch<void>(`/simulations/${id}`, { method: "DELETE" }),
  addBuy: (id: string, b: AddBuyRequest) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/buys`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  editBuy: (id: string, i: number, b: Partial<AddBuyRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/buys/${i}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  removeBuy: (id: string, i: number) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/buys/${i}`, {
      method: "DELETE",
    }),
  addSell: (id: string, b: AddSellRequest) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/sells`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  editSell: (id: string, i: number, b: Partial<AddSellRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/sells/${i}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  removeSell: (id: string, i: number) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/sells/${i}`, {
      method: "DELETE",
    }),
  addLoanIn: (id: string, b: AddLoanInRequest) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-in`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  editLoanIn: (id: string, i: number, b: Partial<AddLoanInRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-in/${i}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  removeLoanIn: (id: string, i: number) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-in/${i}`, {
      method: "DELETE",
    }),
  addLoanOut: (id: string, b: AddLoanOutRequest) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-out`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  editLoanOut: (id: string, i: number, b: Partial<AddLoanOutRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-out/${i}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  removeLoanOut: (id: string, i: number) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-out/${i}`, {
      method: "DELETE",
    }),
};

//  FFP
export const ffpApi = {
  dashboard: (clubId: number, simId?: string) =>
    apiFetch<FFPDashboardResponse>(
      `/ffp/club/${clubId}${simId ? `?sim_id=${simId}` : ""}`,
    ),
};

//  Admin
export const adminApi = {
  listUsers: () => apiFetch<UserResponse[]>("/admin/users"),
  updateUser: (
    userId: string,
    b: { role?: string; is_active?: boolean; club_affiliation?: string },
  ) =>
    apiFetch<UserResponse>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
};

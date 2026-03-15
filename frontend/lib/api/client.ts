// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://localhost:8000";
const BASE = `${BACKEND}/api/v1`;

// Current football season year (2025 = 2025/26 season)
export const CURRENT_SEASON =
  new Date().getMonth() >= 6
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;

// ─── Token Management ─────────────────────────────────────────────────────────
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<boolean> | null = null;

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  try {
    sessionStorage.setItem("_at", access);
    sessionStorage.setItem("_rt", refresh);
  } catch {}
}
export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  try {
    sessionStorage.removeItem("_at");
    sessionStorage.removeItem("_rt");
  } catch {}
}
export function getAccessToken(): string | null {
  if (!_accessToken)
    try {
      _accessToken = sessionStorage.getItem("_at");
    } catch {}
  return _accessToken;
}
export function getRefreshToken(): string | null {
  if (!_refreshToken)
    try {
      _refreshToken = sessionStorage.getItem("_rt");
    } catch {}
  return _refreshToken;
}
export function isAuthenticated() {
  return !!getAccessToken();
}

// ─── Core Fetch ───────────────────────────────────────────────────────────────
async function doRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
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
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (e) {
    throw new Error(
      "Cannot connect to server. Please check that the backend is running.",
    );
  }

  if (res.status === 401 && retry) {
    const refreshed = await doRefresh();
    if (refreshed) return apiFetch<T>(path, options, false);
    clearTokens();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") errMsg = body.detail;
      else if (Array.isArray(body.detail))
        errMsg = body.detail.map((e: any) => e.msg).join(", ");
    } catch {}
    throw new Error(errMsg);
  }

  const text = await res.text();
  if (!text || text === "null") return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
  }) =>
    apiFetch<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => apiFetch<UserResponse>("/auth/me"),
  updateMe: (body: {
    full_name?: string;
    username?: string;
    club_affiliation?: string;
  }) =>
    apiFetch<UserResponse>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// ─── Search ───────────────────────────────────────────────────────────────────
export const searchApi = {
  clubs: (q: string, country = "") =>
    apiFetch<ClubSearchResult[]>(
      `/search/clubs?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`,
    ),
};

// ─── Clubs ────────────────────────────────────────────────────────────────────
export const clubsApi = {
  get: (id: number, season = CURRENT_SEASON) =>
    apiFetch<ClubResponse>(`/clubs/${id}?season=${season}`),
  squad: async (id: number, viewSeason = CURRENT_SEASON) => {
    const data = await apiFetch<any>(
      `/clubs/${id}/squad?view_season=${viewSeason}`,
    );
    // Debug: log the actual shape in development
    if (process.env.NODE_ENV === "development") {
      if (Array.isArray(data)) {
        console.log("[Squad] flat array, length:", data.length);
      } else if (data && typeof data === "object") {
        console.log(
          "[Squad] object keys:",
          Object.keys(data),
          "| array keys:",
          Object.keys(data)
            .filter((k) => Array.isArray((data as any)[k]))
            .map((k) => `${k}(${(data as any)[k].length})`),
        );
      }
    }
    return data as SquadResponse;
  },
  setRevenue: (
    id: number,
    body: { annual_revenue: number; season_year: number },
  ) =>
    apiFetch<ClubResponse>(`/clubs/${id}/revenue`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  sync: (id: number) => apiFetch<any>(`/clubs/${id}/sync`, { method: "POST" }),
};

// ─── Players ──────────────────────────────────────────────────────────────────
export const playersApi = {
  get: (id: number) => apiFetch<PlayerData>(`/players/${id}`),
  setOverride: (id: number, body: PlayerOverrideRequest) =>
    apiFetch<PlayerOverrideResponse>(`/players/${id}/override`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteOverride: (id: number) =>
    apiFetch<void>(`/players/${id}/override`, { method: "DELETE" }),
  listOverrides: (id: number) =>
    apiFetch<PlayerOverrideResponse[]>(`/players/${id}/overrides`),
  getLoan: (id: number) =>
    apiFetch<LoanDealResponse | LoanDealResponse[]>(`/players/${id}/loan`),
  setLoan: (id: number, body: LoanDealRequest) =>
    apiFetch<LoanDealResponse>(`/players/${id}/loan`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteLoan: (id: number, direction: "in" | "out") =>
    apiFetch<void>(`/players/${id}/loan/${direction}`, { method: "DELETE" }),
  exerciseOption: (id: number, direction: "in" | "out", notes = "") =>
    apiFetch<LoanDealResponse>(
      `/players/${id}/loan/${direction}/exercise-option`,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
      },
    ),
  getContractExtension: (id: number) =>
    apiFetch<ContractExtensionResponse[]>(`/players/${id}/contract-extension`),
  setContractExtension: (id: number, body: ContractExtensionRequest) =>
    apiFetch<ContractExtensionResponse>(`/players/${id}/contract-extension`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteContractExtension: (id: number) =>
    apiFetch<void>(`/players/${id}/contract-extension`, { method: "DELETE" }),
};

// ─── Squad Overrides ──────────────────────────────────────────────────────────
export const squadOverridesApi = {
  list: (clubId: number) =>
    apiFetch<SquadOverrideResponse[]>(`/squad-overrides/clubs/${clubId}`),
  create: (clubId: number, body: SquadOverrideCreateRequest) =>
    apiFetch<SquadOverrideResponse>(`/squad-overrides/clubs/${clubId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  delete: (overrideId: string) =>
    apiFetch<void>(`/squad-overrides/${overrideId}`, { method: "DELETE" }),
  effective: (clubId: number, season = CURRENT_SEASON) =>
    apiFetch<SquadResponse>(
      `/squad-overrides/clubs/${clubId}/effective?season_year=${season}`,
    ),
};

// ─── Simulations ──────────────────────────────────────────────────────────────
export const simulationsApi = {
  create: (body: SimulationCreateRequest) =>
    apiFetch<SimulationResponse>("/simulations/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listMy: () => apiFetch<SimulationSummary[]>("/simulations/my"),
  get: (id: string) => apiFetch<SimulationResponse>(`/simulations/${id}`),
  update: (id: string, body: Partial<UpdateSimulationMetaRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiFetch<void>(`/simulations/${id}`, { method: "DELETE" }),
  addBuy: (id: string, body: AddBuyRequest) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/buys`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  editBuy: (id: string, idx: number, body: Partial<AddBuyRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/buys/${idx}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeBuy: (id: string, idx: number) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/buys/${idx}`, {
      method: "DELETE",
    }),
  addSell: (id: string, body: AddSellRequest) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/sells`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  editSell: (id: string, idx: number, body: Partial<AddSellRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/sells/${idx}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeSell: (id: string, idx: number) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/sells/${idx}`, {
      method: "DELETE",
    }),
  addLoanIn: (id: string, body: AddLoanInRequest) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-in`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  editLoanIn: (id: string, idx: number, body: Partial<AddLoanInRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-in/${idx}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeLoanIn: (id: string, idx: number) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-in/${idx}`, {
      method: "DELETE",
    }),
  addLoanOut: (id: string, body: AddLoanOutRequest) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-out`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  editLoanOut: (id: string, idx: number, body: Partial<AddLoanOutRequest>) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-out/${idx}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeLoanOut: (id: string, idx: number) =>
    apiFetch<SimulationResponse>(`/simulations/${id}/loans-out/${idx}`, {
      method: "DELETE",
    }),
};

// ─── FFP ──────────────────────────────────────────────────────────────────────
export const ffpApi = {
  dashboard: (clubId: number, simId?: string) =>
    apiFetch<FFPDashboardResponse>(
      `/ffp/club/${clubId}${simId ? `?sim_id=${simId}` : ""}`,
    ),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  listUsers: () => apiFetch<UserResponse[]>("/admin/users"),
  updateUser: (
    userId: string,
    body: { role?: string; is_active?: boolean; club_affiliation?: string },
  ) =>
    apiFetch<UserResponse>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: string;
}
export interface UserResponse {
  id: string;
  email: string;
  username: string;
  role: "anonymous" | "user" | "sport_director" | "admin";
  full_name?: string;
  club_affiliation?: string;
  created_at: string;
}
export interface ClubSearchResult {
  api_football_id: number;
  name: string;
  country: string;
  league: string;
  logo_url?: string;
}
export interface ClubResponse {
  id: string;
  api_football_id: number;
  name: string;
  short_name: string;
  country: string;
  league: string;
  logo_url: string;
  season_year: number;
  annual_revenue: number;
  revenue_configured: boolean;
  last_synced_at: string;
}
export interface PlayerData {
  // Core identity
  id?: string;
  api_football_id: number;
  name: string;
  full_name?: string;
  age?: number;
  date_of_birth?: string;
  nationality?: string;
  position?: string;
  photo_url?: string;
  // Financials — backend may use either field name
  transfer_value?: number;
  annual_salary?: number; // normalized from estimated_annual_salary
  estimated_annual_salary?: number; // raw backend field
  salary_source?: string;
  // Contract
  contract_signing_date?: string;
  contract_expiry_date?: string;
  contract_expiry_year?: number;
  contract_length_years?: number;
  acquisition_fee?: number;
  acquisition_year?: number;
  // Loan (incoming)
  is_on_loan?: boolean;
  loan_from_club?: string;
  loan_end_date?: string;
  // Loan (outgoing — loaned out from this club)
  loaned_out?: boolean;
  loaned_out_to_club?: string;
  loaned_out_end_date?: string;
  loan_option_to_buy?: boolean;
  loan_option_to_buy_fee?: number | null;
  // Meta
  data_source?: string;
  transfermarkt_url?: string | null;
  [key: string]: any;
}
export interface SquadResponse {
  players: PlayerData[];
  expired_contracts?: PlayerData[];
  [key: string]: any;
}
export interface PlayerOverrideRequest {
  name?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  age?: number | null;
  nationality?: string | null;
  position?: string | null;
  photo_url?: string | null;
  transfer_value?: number | null;
  annual_salary?: number | null;
  contract_signing_date?: string | null;
  contract_expiry_date?: string | null;
  contract_expiry_year?: number | null;
  contract_length_years?: number | null;
  acquisition_fee?: number | null;
  acquisition_year?: number | null;
  is_on_loan?: boolean | null;
  loan_from_club?: string | null;
  loan_end_date?: string | null;
  loan_fee?: number | null;
  loan_wage_contribution_pct?: number | null;
  transfermarkt_url?: string | null;
  notes?: string;
}
export interface PlayerOverrideResponse extends PlayerOverrideRequest {
  id: string;
  player_id: string;
  player_name: string;
  club_id: string;
  set_by_role: string;
  set_by_user_id: string;
  annual_amortization?: number;
  created_at: string;
  updated_at: string;
}
export interface LoanDealRequest {
  loan_direction: "in" | "out";
  counterpart_club_name?: string;
  counterpart_club_api_football_id?: number | null;
  loan_start_date?: string | null;
  loan_end_date?: string | null;
  loan_season?: string;
  loan_fee?: number;
  annual_salary?: number;
  wage_contribution_pct?: number;
  has_option_to_buy?: boolean;
  option_to_buy_fee?: number | null;
  option_is_obligation?: boolean;
  option_contract_years?: number | null;
  option_annual_salary?: number | null;
  option_exercised?: boolean;
  notes?: string;
}
export interface LoanDealResponse {
  id: string;
  player_id: string;
  player_name: string;
  club_id: string;
  club_api_football_id: number;
  set_by_role: string;
  set_by_user_id: string;
  loan_direction: string;
  counterpart_club_name: string;
  counterpart_club_api_football_id?: number | null;
  loan_start_date?: string | null;
  loan_end_date?: string | null;
  loan_season: string;
  loan_fee: number;
  annual_salary: number;
  wage_contribution_pct: number;
  effective_wage_impact: number;
  has_option_to_buy: boolean;
  option_to_buy_fee?: number | null;
  option_is_obligation: boolean;
  option_contract_years?: number | null;
  option_annual_salary?: number | null;
  option_exercised: boolean;
  option_exercised_at?: string | null;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface ContractExtensionRequest {
  new_contract_expiry_year: number;
  new_contract_length_years: number;
  new_annual_salary?: number | null;
  extension_start_year: number;
  signing_bonus?: number;
  notes?: string;
}
export interface ContractExtensionResponse {
  id: string;
  player_id: string;
  player_name: string;
  club_id: string;
  set_by_role: string;
  set_by_user_id: string;
  new_contract_expiry_year: number;
  new_contract_length_years: number;
  new_annual_salary?: number | null;
  extension_start_year: number;
  signing_bonus: number;
  signing_bonus_amortization: number;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface SquadOverrideCreateRequest {
  action: "add" | "remove";
  season_year?: number;
  api_football_player_id?: number | null;
  player_name?: string;
  position?: string;
  age?: number | null;
  nationality?: string;
  transfer_value?: number;
  annual_salary?: number;
  contract_signing_date?: string | null;
  contract_expiry_year?: number;
  contract_length_years?: number;
  is_on_loan?: boolean;
  loan_from_club?: string | null;
  loan_end_date?: string | null;
  acquisition_fee?: number;
  photo_url?: string;
  notes?: string;
}
export interface SquadOverrideResponse {
  id: string;
  club_api_football_id: number;
  set_by_user_id: string;
  set_by_role: string;
  action: string;
  api_football_player_id?: number | null;
  player_name: string;
  position: string;
  season_year: number;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface SimulationCreateRequest {
  club_api_football_id: number;
  simulation_name: string;
  window_type: "summer" | "winter";
  season: string;
  is_public?: boolean;
}
export interface UpdateSimulationMetaRequest {
  simulation_name?: string;
  window_type?: "summer" | "winter";
  season?: string;
  is_public?: boolean;
}
export interface AddBuyRequest {
  player_name: string;
  position: string;
  age: number;
  nationality: string;
  transfer_fee: number;
  annual_salary: number;
  contract_length_years: number;
  api_football_player_id?: number | null;
}
export interface AddSellRequest {
  player_name: string;
  position: string;
  transfer_fee: number;
  api_football_player_id?: number | null;
  annual_salary: number;
  contract_length_years: number;
}
export interface AddLoanInRequest {
  player_name: string;
  position: string;
  age: number;
  api_football_player_id?: number | null;
  loan_fee: number;
  annual_salary: number;
  wage_contribution_pct: number;
  contract_length_years: number;
  has_option_to_buy?: boolean;
  option_to_buy_fee?: number | null;
  option_to_buy_year?: number | null;
}
export interface AddLoanOutRequest {
  player_name: string;
  position: string;
  api_football_player_id?: number | null;
  loan_fee_received: number;
  annual_salary: number;
  wage_contribution_pct: number;
  contract_length_years: number;
  has_option_to_sell?: boolean;
  option_to_sell_fee?: number | null;
  option_to_sell_year?: number | null;
}
export interface SimulationResponse {
  id: string;
  user_id: string;
  club_api_football_id: number;
  club_name: string;
  simulation_name: string;
  window_type: string;
  season: string;
  buys: any[];
  sells: any[];
  loans_in: any[];
  loans_out: any[];
  used_salary_overrides: boolean;
  projections: YearlyProjection[];
  total_buy_fees: number;
  total_sell_fees: number;
  total_loan_fees_paid: number;
  total_loan_fees_received: number;
  net_spend: number;
  overall_ffp_status: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}
export interface SimulationSummary {
  id: string;
  club_name: string;
  club_api_football_id: number;
  simulation_name: string;
  window_type: string;
  season: string;
  total_buys: number;
  total_sells: number;
  total_loans_in: number;
  total_loans_out: number;
  net_spend: number;
  overall_ffp_status: string;
  is_public: boolean;
  created_at: string;
}
export interface FFPDashboardResponse {
  club_id: string;
  club_name: string;
  annual_revenue: number;
  season_year: number;
  salary_data_source: string;
  current_wage_bill: number;
  current_amortization: number;
  current_squad_cost: number;
  current_squad_cost_ratio: number;
  current_ffp_status: FFPStatus;
  projections: YearlyProjection[];
  squad_cost_ratio_limit: number;
  squad_cost_ratio_warning: number;
  break_even_limit_eur: number;
  break_even_equity_limit_eur: number;
  revenue_configured: boolean;
  simulation_id?: string | null;
  simulation_name?: string | null;
  baseline_wage_bill?: number | null;
  simulation_extra_wages?: number | null;
  simulation_wage_relief?: number | null;
  simulation_net_spend?: number | null;
}
export interface FFPStatus {
  status: string;
  color: string;
  badge: string;
  reason: string;
  squad_cost_ratio: number;
  break_even_result: number;
  break_even_ok: boolean;
}
export interface YearlyProjection {
  year: number;
  revenue: number;
  wage_bill: number;
  amortization: number;
  squad_cost: number;
  squad_cost_ratio: number;
  net_transfer_spend: number;
  operating_result: number;
  ffp_status: string;
}

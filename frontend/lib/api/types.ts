// AUTO-GENERATED from openapi.json — do not edit manually
// Run: npm run generate-types

export type UserRole = 'anonymous' | 'user' | 'sport_director' | 'admin';
export type WindowType = 'summer' | 'winter';

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  full_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  role: string;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  full_name: string;
  club_affiliation: string;
  created_at: string;
}

export interface UserUpdateRequest {
  full_name?: string | null;
  username?: string | null;
  club_affiliation?: string | null;
}

export interface AdminUserUpdateRequest {
  role?: UserRole | null;
  is_active?: boolean | null;
  club_affiliation?: string | null;
}

export interface ClubSearchResult {
  api_football_id: number;
  name: string;
  country: string;
  league: string;
  logo_url: string;
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
  last_synced_at: string;
}

export interface ClubRevenueUpdate {
  annual_revenue: number;
  season_year: number;
}

export interface SalaryOverrideRequest {
  annual_salary: number;
  contract_length_years: number;
  contract_expiry_year: number;
  acquisition_fee?: number;
  acquisition_year?: number;
  notes?: string;
}

export interface SalaryOverrideResponse {
  id: string;
  player_id: string;
  club_id: string;
  annual_salary: number;
  contract_length_years: number;
  contract_expiry_year: number;
  acquisition_fee: number;
  notes: string;
  updated_at: string;
}

export interface BuyEntry {
  player_name: string;
  position: string;
  age: number;
  nationality?: string;
  transfer_fee: number;
  annual_salary: number;
  contract_length_years: number;
  api_football_player_id?: number | null;
}

export interface SellEntry {
  player_name: string;
  position: string;
  transfer_fee: number;
  api_football_player_id?: number | null;
  annual_salary?: number;
  contract_length_years?: number;
}

export interface LoanInEntry {
  player_name: string;
  position: string;
  age?: number | null;
  api_football_player_id?: number | null;
  loan_fee?: number;
  annual_salary: number;
  wage_contribution_pct?: number;
  contract_length_years?: number;
  has_option_to_buy?: boolean;
  option_to_buy_fee?: number;
  option_to_buy_year?: number;
}

export interface LoanOutEntry {
  player_name: string;
  position: string;
  api_football_player_id?: number | null;
  loan_fee_received?: number;
  annual_salary?: number;
  wage_contribution_pct?: number;
  contract_length_years?: number;
  has_option_to_sell?: boolean;
  option_to_sell_fee?: number;
  option_to_sell_year?: number;
}

export interface AddBuyRequest {
  player_name: string;
  position: string;
  age: number;
  nationality?: string;
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
  annual_salary?: number;
  contract_length_years?: number;
}

export interface AddLoanInRequest {
  player_name: string;
  position: string;
  age?: number | null;
  api_football_player_id?: number | null;
  loan_fee?: number;
  annual_salary: number;
  wage_contribution_pct?: number;
  contract_length_years?: number;
  has_option_to_buy?: boolean;
  option_to_buy_fee?: number;
  option_to_buy_year?: number;
}

export interface AddLoanOutRequest {
  player_name: string;
  position: string;
  api_football_player_id?: number | null;
  loan_fee_received?: number;
  annual_salary?: number;
  wage_contribution_pct?: number;
  contract_length_years?: number;
  has_option_to_sell?: boolean;
  option_to_sell_fee?: number;
  option_to_sell_year?: number;
}

export interface SimulationCreateRequest {
  club_api_football_id: number;
  simulation_name: string;
  window_type?: WindowType;
  season?: string;
  is_public?: boolean;
}

export interface UpdateSimulationMetaRequest {
  simulation_name?: string | null;
  window_type?: WindowType | null;
  season?: string | null;
  is_public?: boolean | null;
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

export interface FFPStatus {
  status: string;
  color: string;
  badge: string;
  reason: string;
  squad_cost_ratio: number;
  break_even_result: number;
  break_even_ok: boolean;
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
  squad_cost_ratio_limit?: number;
  squad_cost_ratio_warning?: number;
  break_even_limit_eur?: number;
  break_even_equity_limit_eur?: number;
  revenue_configured: boolean;
  simulation_id?: string | null;
  simulation_name?: string | null;
  baseline_wage_bill?: number | null;
  simulation_extra_wages?: number | null;
  simulation_wage_relief?: number | null;
  simulation_net_spend?: number | null;
}

export interface SimulationResponse {
  id: string;
  user_id: string;
  club_api_football_id: number;
  club_name: string;
  simulation_name: string;
  window_type: WindowType;
  season: string;
  buys: BuyEntry[];
  sells: SellEntry[];
  loans_in: LoanInEntry[];
  loans_out: LoanOutEntry[];
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
  window_type: WindowType;
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

export interface ApiError {
  detail?: string | { msg: string; loc: string[]; type: string }[];
  message?: string;
}

// Player type — unknown schema, best-effort
export interface PlayerData {
  api_football_id?: number;
  id?: string;
  name?: string;
  firstname?: string;
  lastname?: string;
  photo_url?: string;
  photo?: string;
  position?: string;
  age?: number;
  nationality?: string;
  annual_salary?: number;
  estimated_salary?: number;
  salary_override?: SalaryOverrideResponse;
  contract_expiry_year?: number;
  club_name?: string;
  height?: string;
  weight?: string;
  injured?: boolean;
  [key: string]: unknown;
}

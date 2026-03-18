// Shared / Auth
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

//  Clubs
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

// Players
export interface PlayerData {
  id?: string;
  api_football_id: number;
  name: string;
  full_name?: string;
  age?: number;
  date_of_birth?: string;
  nationality?: string;
  position?: string;
  photo_url?: string;
  // Financials (backend may use either field name)
  transfer_value?: number;
  annual_salary?: number;
  estimated_annual_salary?: number;
  salary_source?: string;
  // Contract
  contract_signing_date?: string;
  contract_expiry_date?: string;
  contract_expiry_year?: number;
  contract_length_years?: number;
  acquisition_fee?: number;
  acquisition_year?: number;
  // Loan in (player borrowed from another club)
  is_on_loan?: boolean;
  loan_from_club?: string;
  loan_end_date?: string;
  // Loan out (player sent from this club to another)
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

// Loans
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

// Contract Extensions
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

// Squad Overrides
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

// Simulations
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

//  FFP
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

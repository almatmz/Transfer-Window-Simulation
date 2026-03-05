export type UserRole = 'user' | 'sport_director' | 'admin'

export interface User {
  id: string; email: string; username: string; role: UserRole
  full_name: string; club_affiliation: string; created_at: string
}
export interface TokenResponse {
  access_token: string; refresh_token: string; token_type: string; role: UserRole
}
export interface ClubSearchResult {
  api_football_id: number; name: string; country: string; logo_url: string
}
export interface Club {
  id: string; api_football_id: number; name: string; country: string; league: string
  logo_url: string; annual_revenue: number; equity_injection_limit: number
  season_year: number; revenue_configured: boolean; last_synced_at: string
}
export interface SquadPlayer {
  player_id: string; api_football_id: number; name: string; age: number
  position: string; nationality: string; photo_url: string
  contract_expiry_year: number; has_contract: boolean
  annual_salary?: number | null; amortization_per_year?: number | null; data_source?: string | null
}
export interface PlayerContract {
  id: string; player_id: string; player_name: string; position: string
  contract_type: 'permanent' | 'loan'; contract_start_year: number; contract_expiry_year: number
  annual_salary: number; acquisition_fee: number; amortization_per_year: number
  remaining_book_value: number; loan_wage_contribution_pct: number; data_source: string; is_active: boolean
}
export type FFPStatusValue = 'OK' | 'WARNING' | 'VIOLATION'
export type OverallStatus = 'SAFE' | 'MONITORING' | 'HIGH_RISK'
export interface YearlyProjection {
  year: number; revenue: number; wage_bill: number; amortization: number
  squad_cost: number; squad_cost_ratio: number; net_transfer_spend: number
  operating_result: number; ffp_status: OverallStatus; squad_cost_status: FFPStatusValue
}
export interface FFPDashboard {
  club_id: string; club_name: string; annual_revenue: number; season_year: number
  contract_count: number; wage_bill: number; total_amortization: number
  squad_cost: number; squad_cost_ratio: number; squad_cost_status: FFPStatusValue
  break_even_result: number; break_even_status: FFPStatusValue; overall_status: OverallStatus
  squad_cost_ratio_pct: string; break_even_label: string; projections: YearlyProjection[]
  squad_cost_ratio_limit: number; squad_cost_ratio_warning: number
  break_even_limit_eur: number; break_even_equity_limit_eur: number
  simulation_id?: string | null; simulation_name?: string | null
  sim_added_wages?: number | null; sim_added_amortization?: number | null
  sim_removed_wages?: number | null; sim_net_spend?: number | null
}
export type TransferType = 'buy' | 'sell' | 'loan_in' | 'loan_out'
export type WindowType = 'summer' | 'winter'
export interface SimulationTransfer {
  id: string; simulation_id: string; type: TransferType; player_name: string
  position: string; age: number; transfer_fee: number; annual_salary: number
  contract_length_years: number; loan_fee: number; loan_fee_received: number
  loan_wage_contribution_pct: number; option_to_buy_enabled: boolean
  option_to_buy_fee: number; created_at: string
}
export interface Simulation {
  id: string; club_name: string; club_api_football_id: number; name: string
  season_year: number; window_type: WindowType; transfers: SimulationTransfer[]
  is_public: boolean; created_at: string; updated_at: string
}
export interface AdminStats { total_users: number; by_role: Record<string,number>; active: number }

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

export const registerSchema = z.object({
  email: z.string().email('Valid email required'),
  username: z.string().min(3, 'Min 3 chars').max(50, 'Max 50 chars'),
  password: z.string().min(8, 'Min 8 chars'),
  full_name: z.string().optional(),
});

export const searchSchema = z.object({
  q: z.string().min(2, 'Min 2 characters'),
  country: z.string().optional(),
});

export const addBuySchema = z.object({
  player_name: z.string().min(1, 'Required'),
  position: z.string().min(1, 'Required'),
  age: z.number().int().min(15).max(45),
  nationality: z.string().optional(),
  transfer_fee: z.number().min(0),
  annual_salary: z.number().positive('Must be > 0'),
  contract_length_years: z.number().int().min(1).max(10),
  api_football_player_id: z.number().int().optional().nullable(),
});

export const addSellSchema = z.object({
  player_name: z.string().min(1, 'Required'),
  position: z.string().min(1, 'Required'),
  transfer_fee: z.number().min(0),
  api_football_player_id: z.number().int().optional().nullable(),
  annual_salary: z.number().min(0).optional(),
  contract_length_years: z.number().int().min(1).max(10).optional(),
});

export const addLoanInSchema = z.object({
  player_name: z.string().min(1, 'Required'),
  position: z.string().min(1, 'Required'),
  age: z.number().int().min(15).max(45).optional().nullable(),
  annual_salary: z.number().positive('Must be > 0'),
  wage_contribution_pct: z.number().min(0).max(100).default(50),
  loan_fee: z.number().min(0).default(0),
  contract_length_years: z.number().int().min(1).max(3).default(1),
  has_option_to_buy: z.boolean().default(false),
  option_to_buy_fee: z.number().min(0).default(0),
  option_to_buy_year: z.number().int().min(0).default(0),
  api_football_player_id: z.number().int().optional().nullable(),
});

export const addLoanOutSchema = z.object({
  player_name: z.string().min(1, 'Required'),
  position: z.string().min(1, 'Required'),
  annual_salary: z.number().min(0).default(0),
  loan_fee_received: z.number().min(0).default(0),
  wage_contribution_pct: z.number().min(0).max(100).default(0),
  contract_length_years: z.number().int().min(1).max(3).default(1),
  has_option_to_sell: z.boolean().default(false),
  option_to_sell_fee: z.number().min(0).default(0),
  option_to_sell_year: z.number().int().min(0).default(0),
  api_football_player_id: z.number().int().optional().nullable(),
});

export const salaryOverrideSchema = z.object({
  annual_salary: z.number().positive('Required'),
  contract_length_years: z.number().int().min(1).max(10),
  contract_expiry_year: z.number().int().min(2020).max(2040),
  acquisition_fee: z.number().min(0).default(0),
  acquisition_year: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const revenueSchema = z.object({
  annual_revenue: z.number().positive('Must be positive'),
  season_year: z.number().int().min(2000).max(2040),
});

export const simulationCreateSchema = z.object({
  club_api_football_id: z.number().int().positive(),
  simulation_name: z.string().min(2).max(100),
  window_type: z.enum(['summer', 'winter']).default('summer'),
  season: z.string().default('2025/26'),
  is_public: z.boolean().default(false),
});

export const updateSimMetaSchema = z.object({
  simulation_name: z.string().min(2).max(100).optional().nullable(),
  window_type: z.enum(['summer', 'winter']).optional().nullable(),
  season: z.string().optional().nullable(),
  is_public: z.boolean().optional().nullable(),
});

export const updateProfileSchema = z.object({
  full_name: z.string().optional().nullable(),
  username: z.string().min(3).max(50).optional().nullable(),
  club_affiliation: z.string().optional().nullable(),
});

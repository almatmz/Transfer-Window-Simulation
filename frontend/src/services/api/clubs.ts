import { api } from './client'
import type { Club, ClubSearchResult, SquadPlayer, PlayerContract } from '@/types'

export const clubsApi = {
  search: (q: string, country = '') =>
    api.get<ClubSearchResult[]>('/search/clubs', { params: { q, country } }).then(r => r.data),
  get: (id: number) => api.get<Club>(`/clubs/${id}`).then(r => r.data),
  squad: (id: number) => api.get<SquadPlayer[]>(`/clubs/${id}/squad`).then(r => r.data),
  contracts: (id: number) => api.get<PlayerContract[]>(`/clubs/${id}/contracts`).then(r => r.data),
  updateRevenue: (id: number, annual_revenue: number, season_year?: number) =>
    api.patch<Club>(`/clubs/${id}/revenue`, { annual_revenue, season_year }).then(r => r.data),
  sync: (id: number) => api.post(`/clubs/${id}/sync`).then(r => r.data),
  createContract: (id: number, data: Record<string, unknown>) =>
    api.post(`/clubs/${id}/contracts`, data).then(r => r.data),
  extendContract: (contractId: string, new_expiry_year: number, new_annual_salary: number) =>
    api.patch(`/clubs/contracts/${contractId}/extend`, { new_expiry_year, new_annual_salary }).then(r => r.data),
  terminateContract: (contractId: string) =>
    api.delete(`/clubs/contracts/${contractId}`),
}

import { api } from './client'
import type { Simulation, SimulationTransfer } from '@/types'

export const simulationsApi = {
  list: () => api.get<Simulation[]>('/simulations').then(r => r.data),
  get: (id: string) => api.get<Simulation>(`/simulations/${id}`).then(r => r.data),
  create: (data: { club_api_football_id: number; name: string; season_year: number; window_type: string }) =>
    api.post<Simulation>('/simulations', data).then(r => r.data),
  delete: (id: string) => api.delete(`/simulations/${id}`),
  addTransfer: (simId: string, data: Record<string, unknown>) =>
    api.post<SimulationTransfer>(`/simulations/${simId}/transfers`, data).then(r => r.data),
  removeTransfer: (simId: string, transferId: string) =>
    api.delete(`/simulations/${simId}/transfers/${transferId}`),
}

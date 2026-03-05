import { api } from './client'
import type { FFPDashboard } from '@/types'

export const ffpApi = {
  dashboard: (clubId: number, simId?: string) =>
    api.get<FFPDashboard>(`/ffp/club/${clubId}`, { params: simId ? { sim_id: simId } : {} }).then(r => r.data),
}

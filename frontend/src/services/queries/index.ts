import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { clubsApi } from '../api/clubs'
import { simulationsApi } from '../api/simulations'
import { ffpApi } from '../api/ffp'
import { adminApi } from '../api/admin'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const useMe = () => useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false })

export const useUpdateMe = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: authApi.updateMe, onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) })
}

// ── Clubs ─────────────────────────────────────────────────────────────────────
export const useClubSearch = (q: string, country = '') =>
  useQuery({ queryKey: ['clubs', 'search', q, country], queryFn: () => clubsApi.search(q, country), enabled: q.length >= 2 })

export const useClub = (id: number) =>
  useQuery({ queryKey: ['club', id], queryFn: () => clubsApi.get(id), enabled: !!id })

export const useSquad = (id: number) =>
  useQuery({ queryKey: ['squad', id], queryFn: () => clubsApi.squad(id), enabled: !!id })

export const useContracts = (id: number) =>
  useQuery({ queryKey: ['contracts', id], queryFn: () => clubsApi.contracts(id), enabled: !!id })

export const useUpdateRevenue = (clubId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ revenue, season }: { revenue: number; season?: number }) =>
      clubsApi.updateRevenue(clubId, revenue, season),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['club', clubId] }); qc.invalidateQueries({ queryKey: ['ffp', clubId] }) },
  })
}

export const useSyncClub = (clubId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => clubsApi.sync(clubId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['squad', clubId] }); qc.invalidateQueries({ queryKey: ['contracts', clubId] }) },
  })
}

export const useExtendContract = (clubId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contractId, expiry, salary }: { contractId: string; expiry: number; salary: number }) =>
      clubsApi.extendContract(contractId, expiry, salary),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', clubId] }),
  })
}

// ── FFP ───────────────────────────────────────────────────────────────────────
export const useFFP = (clubId: number, simId?: string) =>
  useQuery({
    queryKey: ['ffp', clubId, simId],
    queryFn: () => ffpApi.dashboard(clubId, simId),
    enabled: !!clubId,
  })

// ── Simulations ───────────────────────────────────────────────────────────────
export const useSimulations = () =>
  useQuery({ queryKey: ['simulations'], queryFn: simulationsApi.list })

export const useSimulation = (id: string) =>
  useQuery({ queryKey: ['simulation', id], queryFn: () => simulationsApi.get(id), enabled: !!id })

export const useCreateSimulation = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: simulationsApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['simulations'] }) })
}

export const useDeleteSimulation = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: simulationsApi.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ['simulations'] }) })
}

export const useAddTransfer = (simId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => simulationsApi.addTransfer(simId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulation', simId] }),
  })
}

export const useRemoveTransfer = (simId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (transferId: string) => simulationsApi.removeTransfer(simId, transferId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulation', simId] }),
  })
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const useAdminUsers = () => useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.users })
export const useAdminStats = () => useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats })
export const useUpdateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; is_active?: boolean } }) => adminApi.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

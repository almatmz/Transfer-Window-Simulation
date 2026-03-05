import { api } from './client'
import type { User, AdminStats } from '@/types'

export const adminApi = {
  users: () => api.get<User[]>('/admin/users').then(r => r.data),
  stats: () => api.get<AdminStats>('/admin/stats').then(r => r.data),
  updateUser: (id: string, data: { role?: string; is_active?: boolean }) =>
    api.patch<User>(`/admin/users/${id}`, data).then(r => r.data),
  createUser: (data: Record<string, unknown>) =>
    api.post<User>('/admin/users', data).then(r => r.data),
}

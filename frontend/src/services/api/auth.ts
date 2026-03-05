import { api } from './client'
import type { TokenResponse, User } from '@/types'

export const authApi = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { email, password }).then(r => r.data),
  register: (email: string, username: string, password: string, full_name = '') =>
    api.post<TokenResponse>('/auth/register', { email, username, password, full_name }).then(r => r.data),
  me: () => api.get<User>('/auth/me').then(r => r.data),
  updateMe: (data: Partial<User>) => api.patch<User>('/auth/me', data).then(r => r.data),
}

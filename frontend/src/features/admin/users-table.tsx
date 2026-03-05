'use client'
import { useState } from 'react'
import { useAdminUsers, useUpdateUser } from '@/services/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { PageSpinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toaster'
import { UserRole } from '@/types'
import { Users, Edit2 } from 'lucide-react'

const roleBadge: Record<string, 'info' | 'success' | 'warning'> = {
  admin: 'warning', sport_director: 'success', user: 'info',
}

export function UsersTable() {
  const { data: users, isLoading } = useAdminUsers()
  const updateUser = useUpdateUser()
  const [editUser, setEditUser] = useState<{ id: string; role: string; is_active: boolean; name: string } | null>(null)

  if (isLoading) return <PageSpinner />

  const handleSave = async () => {
    if (!editUser) return
    try {
      await updateUser.mutateAsync({ id: editUser.id, data: { role: editUser.role, is_active: editUser.is_active } })
      toast(`Updated ${editUser.name}`, 'success')
      setEditUser(null)
    } catch { toast('Failed to update user', 'error') }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><Users className="w-4 h-4 text-purple-400" /></div>
            <CardTitle>Users ({users?.length || 0})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['User', 'Email', 'Role', 'Status', 'Joined', ''].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {(users || []).map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                          {(u.full_name || u.username)[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{u.full_name || u.username}</p>
                          <p className="text-xs text-slate-600">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{u.email}</td>
                    <td className="px-6 py-4"><Badge variant={roleBadge[u.role] || 'info'}>{u.role.replace('_', ' ')}</Badge></td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${(u as unknown as { is_active: boolean }).is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${(u as unknown as { is_active: boolean }).is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {(u as unknown as { is_active: boolean }).is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <Button size="sm" variant="ghost" onClick={() => setEditUser({ id: u.id, role: u.role, is_active: (u as unknown as { is_active: boolean }).is_active, name: u.full_name || u.username })}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit User — ${editUser?.name}`} size="sm">
        {editUser && (
          <div className="space-y-4">
            <Select label="Role" value={editUser.role} onChange={e => setEditUser(u => u ? { ...u, role: e.target.value } : null)}>
              <option value="user">User</option>
              <option value="sport_director">Sport Director</option>
              <option value="admin">Admin</option>
            </Select>
            <Select label="Status" value={editUser.is_active ? 'active' : 'inactive'} onChange={e => setEditUser(u => u ? { ...u, is_active: e.target.value === 'active' } : null)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button loading={updateUser.isPending} onClick={handleSave}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

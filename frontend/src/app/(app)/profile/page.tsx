'use client'
import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useMe, useUpdateMe } from '@/services/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageSpinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toaster'
import { User, Mail, Building } from 'lucide-react'

const roleBadge: Record<string, 'info' | 'success' | 'warning'> = {
  admin: 'warning', sport_director: 'success', user: 'info',
}

export default function ProfilePage() {
  const { data: user, isLoading } = useMe()
  const updateMe = useUpdateMe()
  const [form, setForm] = useState({ full_name: '', username: '', club_affiliation: '' })
  const [editing, setEditing] = useState(false)

  if (isLoading) return <AppLayout title="Profile"><PageSpinner /></AppLayout>
  if (!user) return null

  const startEdit = () => {
    setForm({ full_name: user.full_name || '', username: user.username, club_affiliation: user.club_affiliation || '' })
    setEditing(true)
  }

  const handleSave = async () => {
    try {
      await updateMe.mutateAsync(form)
      toast('Profile updated', 'success')
      setEditing(false)
    } catch { toast('Failed to update profile', 'error') }
  }

  return (
    <AppLayout title="Profile">
      <div className="max-w-2xl space-y-6">
        {/* Avatar card */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-900/30">
            {(user.full_name || user.username)[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">{user.full_name || user.username}</h2>
            <p className="text-slate-500 text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={roleBadge[user.role] || 'info'}>{user.role.replace('_', ' ')}</Badge>
              <span className="text-xs text-slate-600">Member since {new Date(user.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Account Details</CardTitle>
            {!editing && <Button size="sm" variant="outline" onClick={startEdit}>Edit Profile</Button>}
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <Input label="Full Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                <Input label="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                <Input label="Club Affiliation" placeholder="e.g. Manchester City FC" value={form.club_affiliation} onChange={e => setForm(f => ({ ...f, club_affiliation: e.target.value }))} />
                <div className="flex gap-2 pt-2">
                  <Button loading={updateMe.isPending} onClick={handleSave}>Save Changes</Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <dl className="space-y-4">
                {[
                  { icon: User, label: 'Full Name', value: user.full_name || '—' },
                  { icon: User, label: 'Username', value: `@${user.username}` },
                  { icon: Mail, label: 'Email', value: user.email },
                  { icon: Building, label: 'Club Affiliation', value: user.club_affiliation || '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 py-2 border-b border-slate-800/40 last:border-0">
                    <div className="p-1.5 rounded-lg bg-slate-800/50"><Icon className="w-3.5 h-3.5 text-slate-500" /></div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-600 uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-medium text-slate-200 mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader><CardTitle>Permissions</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { label: 'View club squads', allowed: true },
                { label: 'Create simulations', allowed: true },
                { label: 'View FFP dashboards', allowed: true },
                { label: 'Override player salaries', allowed: user.role === 'sport_director' || user.role === 'admin' },
                { label: 'Edit club revenue', allowed: user.role === 'sport_director' || user.role === 'admin' },
                { label: 'Manage users', allowed: user.role === 'admin' },
                { label: 'Force squad sync', allowed: user.role === 'admin' },
              ].map(({ label, allowed }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800/30 last:border-0">
                  <span className="text-slate-400">{label}</span>
                  <span className={`text-xs font-medium ${allowed ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {allowed ? '✓ Allowed' : '✗ Restricted'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

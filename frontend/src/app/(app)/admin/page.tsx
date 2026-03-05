'use client'
import { AppLayout } from '@/components/layout/app-layout'
import { UsersTable } from '@/features/admin/users-table'
import { useAdminStats } from '@/services/queries'
import { StatCard } from '@/components/ui/stat-card'
import { Users, Shield, Activity } from 'lucide-react'

export default function AdminPage() {
  const { data: stats } = useAdminStats()

  return (
    <AppLayout title="Admin Panel">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 mb-1">Admin Panel</h2>
          <p className="text-slate-500 text-sm">Manage users, roles, and system configuration.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats?.total_users || 0} icon={Users} accent="blue" />
          <StatCard label="Active" value={stats?.active || 0} icon={Activity} accent="emerald" />
          <StatCard label="Sport Directors" value={stats?.by_role?.sport_director || 0} icon={Shield} accent="purple" />
          <StatCard label="Admins" value={stats?.by_role?.admin || 0} icon={Shield} accent="amber" />
        </div>

        <UsersTable />
      </div>
    </AppLayout>
  )
}

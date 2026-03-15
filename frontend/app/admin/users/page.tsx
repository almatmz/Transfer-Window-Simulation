'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageLoader, ErrorMessage, Badge, Button, Modal, Card } from '@/components/ui';
import { roleColor, roleLabel, formatDate } from '@/lib/utils';
import { Shield, Users, Search, Edit, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';

export default function AdminUsersPage() {
  const { role, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<any>(null);

  useEffect(() => {
    if (!loading && (!isAuthenticated || role !== 'admin')) router.replace('/');
  }, [loading, isAuthenticated, role]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
    enabled: role === 'admin',
  });

  const filtered = data?.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoader />;
  if (role !== 'admin') return null;
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.length ?? 0} total users</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up" style={{animationDelay:'0.05s'}}>
        {(['admin', 'sport_director', 'user'] as const).map(r => (
          <Card key={r} className="text-center py-3">
            <p className={cn('font-bold text-xl', roleColor(r).split(' ')[1])}>{data?.filter(u => u.role === r).length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{roleLabel(r)}s</p>
          </Card>
        ))}
        <Card className="text-center py-3">
          <p className="font-bold text-xl text-emerald-600 dark:text-emerald-400">{data?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative animate-fade-up" style={{animationDelay:'0.1s'}}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username or email…"
          className="w-full h-10 pl-10 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      </div>

      {/* Table */}
      <Card padding={false} className="overflow-hidden animate-fade-up" style={{animationDelay:'0.15s'}}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/30">
              {['User', 'Email', 'Role', 'Affiliation', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered?.map(user => (
                <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        {user.full_name && <p className="text-xs text-muted-foreground">{user.full_name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', roleColor(user.role))}>
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{user.club_affiliation || '—'}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(user.created_at)}</td>
                  <td className="py-3 px-4">
                    <Button variant="ghost" size="sm" icon={<Edit className="w-3.5 h-3.5" />} onClick={() => setEditUser(user)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<any>({
    defaultValues: { role: user.role, is_active: user.is_active !== false, club_affiliation: user.club_affiliation ?? '' },
  });
  const onSubmit = async (data: any) => {
    try {
      await adminApi.updateUser(user.id, { role: data.role, is_active: data.is_active === true || data.is_active === 'true', club_affiliation: data.club_affiliation });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`Updated ${user.username}`);
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Modal open={true} onClose={onClose} title={`Edit: ${user.username}`} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        <div>
          <label className="block text-sm font-medium mb-1.5">Role</label>
          <select {...register('role')} className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="user">User</option>
            <option value="sport_director">Sport Director</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Club Affiliation</label>
          <input {...register('club_affiliation')} placeholder="Optional"
            className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_active" {...register('is_active')} className="rounded" defaultChecked={user.is_active !== false} />
          <label htmlFor="is_active" className="text-sm">Account active</label>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting} icon={<Check className="w-3.5 h-3.5" />}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

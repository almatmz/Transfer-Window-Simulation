'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { Button, Card, Skeleton, ErrorMessage, Badge } from '@/components/ui';
import { roleColor, roleLabel, formatDate } from '@/lib/utils';
import { Shield, Save, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserResponse, UserRole } from '@/lib/api/types';

const ROLES: UserRole[] = ['anonymous', 'user', 'sport_director', 'admin'];

export default function AdminUsersPage() {
  const { isAuthenticated, role, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { role?: UserRole; is_active?: boolean; club_affiliation?: string }>>({});

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
    enabled: isAuthenticated && role === 'admin',
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: UserRole; is_active?: boolean; club_affiliation?: string }) =>
      adminApi.updateUser(id, body),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!loading && (!isAuthenticated || role !== 'admin')) {
    router.replace('/');
    return null;
  }

  const setEdit = (userId: string, key: string, value: unknown) => {
    setEdits(prev => ({ ...prev, [userId]: { ...prev[userId], [key]: value } }));
  };

  const saveUser = (user: UserResponse) => {
    const changes = edits[user.id];
    if (!changes || Object.keys(changes).length === 0) return;
    updateMut.mutate({ id: user.id, ...changes });
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-black">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Manage user roles and access</p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        )}

        {error && <ErrorMessage message={(error as Error).message} onRetry={refetch} />}

        {users && (
          <Card className="overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/40 flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Users className="w-3.5 h-3.5" />
              {users.length} users
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">User</th>
                    <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Email</th>
                    <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Role</th>
                    <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Club</th>
                    <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Active</th>
                    <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Joined</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: UserResponse) => {
                    const edit = edits[user.id] ?? {};
                    const isDirty = Object.keys(edit).length > 0;
                    return (
                      <tr key={user.id} className={`border-b border-border/50 last:border-0 ${isDirty ? 'bg-primary/5' : 'hover:bg-muted/20'} transition-colors`}>
                        <td className="p-3">
                          <div>
                            <p className="font-semibold">{user.username}</p>
                            <p className="text-xs text-muted-foreground">{user.full_name}</p>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{user.email}</td>
                        <td className="p-3">
                          <select
                            value={edit.role ?? user.role}
                            onChange={e => setEdit(user.id, 'role', e.target.value as UserRole)}
                            className="h-8 px-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            value={edit.club_affiliation ?? user.club_affiliation ?? ''}
                            onChange={e => setEdit(user.id, 'club_affiliation', e.target.value)}
                            placeholder="Club name"
                            className="h-8 px-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring w-32"
                          />
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => setEdit(user.id, 'is_active', !(edit.is_active ?? true))}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${(edit.is_active ?? true) ? 'bg-emerald-500' : 'bg-muted'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${(edit.is_active ?? true) ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(user.created_at)}</td>
                        <td className="p-3">
                          {isDirty && (
                            <Button size="sm" onClick={() => saveUser(user)} loading={updateMut.isPending}>
                              <Save className="w-3 h-3" /> Save
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </motion.div>
    </div>
  );
}

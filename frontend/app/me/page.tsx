'use client';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api/client';
import { Button, Input, Badge, Card, PageLoader } from '@/components/ui';
import { roleColor, roleLabel, formatDate } from '@/lib/utils';
import { User, Mail, Calendar, Shield, Edit, Check, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { user, loading, isAuthenticated, refreshUser, updateUser } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated]);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({
    defaultValues: { full_name: user?.full_name ?? '', username: user?.username ?? '', club_affiliation: user?.club_affiliation ?? '' },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (user) reset({ full_name: user.full_name ?? '', username: user.username ?? '', club_affiliation: user.club_affiliation ?? '' });
  }, [user]);

  if (loading) return <PageLoader />;
  if (!user) return null;

  const onSubmit = async (data: any) => {
    try {
      const updated = await authApi.updateMe(data);
      updateUser(updated);
      toast.success('Profile updated');
      setEditing(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 animate-fade-up">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl font-display">
          {user.username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl">{user.full_name || user.username}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', roleColor(user.role))}>
              {roleLabel(user.role)}
            </span>
          </div>
        </div>
        <div className="ml-auto">
          {!editing
            ? <Button variant="outline" size="sm" icon={<Edit className="w-3.5 h-3.5" />} onClick={() => setEditing(true)}>Edit</Button>
            : <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5" />} onClick={() => { setEditing(false); reset(); }}>Cancel</Button>}
        </div>
      </div>

      <Card className="animate-fade-up" style={{animationDelay:'0.05s'} as any}>
        {editing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input label="Full Name" {...register('full_name')} error={errors.full_name?.message} />
            <Input label="Username" {...register('username')} helperText="Letters, numbers, underscore" error={errors.username?.message} />
            <Input label="Club Affiliation" {...register('club_affiliation')} placeholder="Optional" />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => { setEditing(false); reset(); }}>Cancel</Button>
              <Button type="submit" className="flex-1" loading={isSubmitting} icon={<Check className="w-3.5 h-3.5" />}>Save Changes</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {[
              { icon: User, label: 'Username', value: user.username },
              { icon: Mail, label: 'Email', value: user.email },
              { icon: Shield, label: 'Role', value: roleLabel(user.role) },
              { icon: User, label: 'Full Name', value: user.full_name || '—' },
              { icon: User, label: 'Club Affiliation', value: user.club_affiliation || '—' },
              { icon: Calendar, label: 'Member Since', value: formatDate(user.created_at) },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <row.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground w-32 shrink-0">{row.label}</span>
                <span className="text-sm font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

'use client';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api/client';
import { Button, Input, Badge, Card, PageLoader } from '@/components/ui';
import { roleColor, roleLabel, formatDate, friendlyError } from '@/lib/utils';
import { User, Mail, Calendar, Shield, Edit, Check, X, Building, Trophy, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const schema = z.object({
  full_name: z.string().min(2,'Name must be at least 2 characters').max(100),
  username: z.string().min(3,'Min 3 characters').max(30).regex(/^[a-zA-Z0-9_]+$/,'Only letters, numbers and underscores'),
  club_affiliation: z.string().max(100).optional(),
});
type F = z.infer<typeof schema>;

const ROLE_DESCRIPTIONS: Record<string, { title: string; desc: string; color: string }> = {
  admin:          { title: 'Administrator',   desc: 'Full access. Can manage users, set official revenues, override all player data.',           color: 'text-red-600 dark:text-red-400' },
  sport_director: { title: 'Sport Director',  desc: 'Can set private salary overrides, loan deals, and revenue estimates for your own use.',     color: 'text-blue-600 dark:text-blue-400' },
  user:           { title: 'User',            desc: 'Can create simulations, save scenarios, and set personal revenue estimates.',               color: 'text-emerald-600 dark:text-emerald-400' },
  anonymous:      { title: 'Guest',           desc: 'Can search clubs and view public squad data. Register for more features.',                   color: 'text-muted-foreground' },
};

export default function ProfilePage() {
  const { user, loading, isAuthenticated, refreshUser, updateUser } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema), mode: 'onBlur',
    defaultValues: { full_name: user?.full_name ?? '', username: user?.username ?? '', club_affiliation: user?.club_affiliation ?? '' },
  });

  useEffect(() => {
    if (user) reset({ full_name: user.full_name ?? '', username: user.username ?? '', club_affiliation: user.club_affiliation ?? '' });
  }, [user, reset]);

  if (loading) return <PageLoader />;
  if (!user) return null;

  const onSubmit = async (data: F) => {
    try {
      const updated = await authApi.updateMe(data);
      updateUser(updated);
      toast.success('Profile updated successfully');
      setEditing(false);
    } catch (e: any) { toast.error(friendlyError(e.message)); }
  };

  const roleInfo = ROLE_DESCRIPTIONS[user.role] ?? ROLE_DESCRIPTIONS.anonymous;
  const memberDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000*60*60*24));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header card */}
      <Card className="animate-fade-up">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl font-display shrink-0">
            {user.username[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl">{user.full_name || user.username}</h1>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', roleColor(user.role))}>
                <Shield className="w-3 h-3 mr-1"/>{roleInfo.title}
              </span>
              {user.club_affiliation && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building className="w-3 h-3"/>{user.club_affiliation}
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" icon={editing ? <X className="w-3.5 h-3.5"/> : <Edit className="w-3.5 h-3.5"/>}
            onClick={() => { setEditing(!editing); if (editing) reset(); }}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
        </div>
      </Card>

      {/* Role info */}
      <Card className="animate-fade-up bg-primary/5 border-primary/20" style={{animationDelay:'0.05s'} as any}>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5"/>
          <div>
            <p className={cn('font-semibold text-sm', roleInfo.color)}>{roleInfo.title} access</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{roleInfo.desc}</p>
          </div>
        </div>
      </Card>

      {/* Edit form / Info display */}
      <Card className="animate-fade-up" style={{animationDelay:'0.1s'} as any}>
        {editing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <h2 className="font-semibold text-sm">Edit Profile</h2>
            <Input label="Full Name" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
            <Input label="Username" autoComplete="username" helperText="Letters, numbers and underscores only" error={errors.username?.message} {...register('username')} />
            <Input label="Club Affiliation" placeholder="e.g. Real Madrid CF (optional)" error={errors.club_affiliation?.message} {...register('club_affiliation')} />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => { setEditing(false); reset(); }}>Cancel</Button>
              <Button type="submit" className="flex-1" loading={isSubmitting} icon={<Check className="w-3.5 h-3.5"/>}>Save Changes</Button>
            </div>
          </form>
        ) : (
          <div>
            <h2 className="font-semibold text-sm mb-4">Account Details</h2>
            <div className="space-y-0 divide-y divide-border">
              {[
                { icon: User,     label: 'Username',         value: `@${user.username}` },
                { icon: Mail,     label: 'Email',            value: user.email },
                { icon: User,     label: 'Full Name',        value: user.full_name || '—' },
                { icon: Building, label: 'Club Affiliation', value: user.club_affiliation || '—' },
                { icon: Calendar, label: 'Member Since',     value: `${formatDate(user.created_at)} (${memberDays} days)` },
                { icon: Trophy,   label: 'Account ID',       value: user.id.slice(-8).toUpperCase(), mono: true },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 py-3">
                  <row.icon className="w-4 h-4 text-muted-foreground shrink-0"/>
                  <span className="text-sm text-muted-foreground w-36 shrink-0">{row.label}</span>
                  <span className={cn('text-sm font-medium', (row as any).mono && 'font-mono text-xs tracking-wider')}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Stats */}
      <Card className="animate-fade-up" style={{animationDelay:'0.15s'} as any}>
        <h2 className="font-semibold text-sm mb-3">What you can do</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Search any club', available: true },
            { label: 'View squad data', available: true },
            { label: 'Create simulations', available: ['user','sport_director','admin'].includes(user.role) },
            { label: 'Set revenue estimate', available: ['user','sport_director','admin'].includes(user.role) },
            { label: 'Set salary overrides', available: ['sport_director','admin'].includes(user.role) },
            { label: 'Set official revenue', available: ['sport_director','admin'].includes(user.role) },
            { label: 'Manage squad overrides', available: ['sport_director','admin'].includes(user.role) },
            { label: 'Manage all users', available: user.role === 'admin' },
          ].map(item => (
            <div key={item.label} className={cn('flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg', item.available ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/5' : 'text-muted-foreground/50')}>
              <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', item.available ? 'bg-emerald-500/20' : 'bg-muted')}>
                {item.available ? '✓' : '—'}
              </span>
              {item.label}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi, ffpApi, CURRENT_SEASON } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { PageLoader, ErrorMessage, Badge, Button, Card, KpiCard, FFPBadge, Modal } from '@/components/ui';
import { formatEur, formatDate, formatPct } from '@/lib/utils';
import { Users, BarChart3, RefreshCw, TrendingUp, Trophy, MapPin, Calendar, DollarSign, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export default function ClubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId);
  const { role, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [revenueOpen, setRevenueOpen] = useState(false);
  const isSdOrAdmin = role === 'sport_director' || role === 'admin';

  const { data: club, isLoading, error } = useQuery({
    queryKey: ['club', id, CURRENT_SEASON],
    queryFn: () => clubsApi.get(id, CURRENT_SEASON),
    enabled: !!id,
  });

  const { data: ffp, isLoading: ffpLoading } = useQuery({
    queryKey: ['ffp', id],
    queryFn: () => ffpApi.dashboard(id),
    enabled: !!id,
  });

  const syncMutation = useMutation({
    mutationFn: () => clubsApi.sync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club', id] });
      qc.invalidateQueries({ queryKey: ['squad', id] });
      toast.success('Sync started — data will update shortly');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <PageLoader />;
  if (error || !club) return <ErrorMessage message={(error as Error)?.message ?? 'Club not found'} />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border">
          {club.logo_url
            ? <Image src={club.logo_url} alt={club.name} width={56} height={56} className="object-contain" unoptimized />
            : <Trophy className="w-8 h-8 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-2xl truncate">{club.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{club.country}</span>
            <span className="text-border text-xs">·</span>
            <span className="text-xs text-muted-foreground">{club.league}</span>
            <Badge variant="info">{club.season_year}/{String(club.season_year + 1).slice(2)}</Badge>
            {ffp && <FFPBadge status={ffp.current_ffp_status.status} />}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {isSdOrAdmin && (
            <>
              <Button variant="outline" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />}
                onClick={() => setRevenueOpen(true)}>Revenue</Button>
              <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />}
                loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>Sync</Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up" style={{animationDelay:'0.05s'}}>
        {[
          { href: `/clubs/${id}/squad`, icon: Users, label: 'View Squad', desc: 'Players & contracts' },
          { href: `/ffp/${id}`, icon: BarChart3, label: 'FFP Dashboard', desc: 'Compliance & projections' },
          { href: `/simulations?club=${id}&name=${encodeURIComponent(club.name)}`, icon: TrendingUp, label: 'Simulate', desc: 'Build transfer scenarios' },
          ...(isSdOrAdmin ? [{ href: `/clubs/${id}/overrides`, icon: Settings, label: 'Squad Overrides', desc: 'Manage squad data' }] : []),
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all group">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-all">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="font-semibold text-sm">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* FFP KPIs */}
      {ffp && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up" style={{animationDelay:'0.1s'}}>
          <KpiCard label="Annual Revenue" value={formatEur(ffp.annual_revenue, true)}
            sub={ffp.revenue_configured ? 'Official' : 'Not configured'}
            icon={<DollarSign className="w-4 h-4" />} />
          <KpiCard label="Wage Bill" value={formatEur(ffp.current_wage_bill, true)}
            icon={<TrendingUp className="w-4 h-4" />} />
          <KpiCard label="Squad Cost Ratio" value={formatPct(ffp.current_squad_cost_ratio)}
            sub={`Limit: ${formatPct(ffp.squad_cost_ratio_limit)}`} />
          <KpiCard label="FFP Status" value={ffp.current_ffp_status.badge || ffp.current_ffp_status.status}
            sub={ffp.current_ffp_status.reason || '—'} />
        </div>
      )}

      {/* Last sync */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-up" style={{animationDelay:'0.15s'}}>
        <Calendar className="w-3.5 h-3.5" />
        Last synced: {formatDate(club.last_synced_at)}
      </div>

      {/* Revenue Modal */}
      <RevenueModal open={revenueOpen} onClose={() => setRevenueOpen(false)}
        clubId={id} seasonYear={club.season_year} currentRevenue={club.annual_revenue} />
    </div>
  );
}

function RevenueModal({ open, onClose, clubId, seasonYear, currentRevenue }: {
  open: boolean; onClose: () => void; clubId: number; seasonYear: number; currentRevenue: number;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ revenue: number }>({
    defaultValues: { revenue: currentRevenue / 1_000_000 }, mode: 'onSubmit',
  });
  const onSubmit = async (data: { revenue: number }) => {
    try {
      await clubsApi.setRevenue(clubId, { annual_revenue: data.revenue * 1_000_000, season_year: seasonYear });
      qc.invalidateQueries({ queryKey: ['club', clubId] });
      qc.invalidateQueries({ queryKey: ['ffp', clubId] });
      toast.success('Revenue updated');
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Set Annual Revenue" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium mb-1.5">Annual Revenue (€M)</label>
          <input type="number" step="0.1" min="0"
            className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            {...register('revenue', { required: true, min: 0, valueAsNumber: true })} />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

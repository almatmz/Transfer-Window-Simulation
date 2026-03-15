'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { simulationsApi, searchApi, CURRENT_SEASON } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { PageLoader, ErrorMessage, EmptyState, Badge, Button, Modal, FFPBadge, Card } from '@/components/ui';
import { formatEur, formatDate } from '@/lib/utils';
import { Plus, Trash2, ExternalLink, Trophy, TrendingUp, Calendar, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';

function SimsContent() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const sp = useNextSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const prefilledClubId = sp.get('club') ? parseInt(sp.get('club')!) : undefined;
  const prefilledClubName = sp.get('name') || '';
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-sims'],
    queryFn: simulationsApi.listMy,
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => simulationsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-sims'] }); toast.success('Simulation deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated]);

  if (loading || (!isAuthenticated && !loading)) return <PageLoader />;
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />My Simulations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.length ?? 0} simulation{data?.length !== 1 ? 's' : ''}</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>New Simulation</Button>
      </div>

      {data?.length === 0 && (
        <EmptyState icon={<TrendingUp className="w-8 h-8" />} title="No simulations yet"
          description="Create a simulation to model transfer scenarios for any club."
          action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Create your first</Button>} />
      )}

      <div className="space-y-2 animate-fade-up" style={{animationDelay:'0.05s'}}>
        {data?.map((sim, i) => (
          <div key={sim.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:border-primary/30 transition-all group"
            style={{ animationDelay: `${i * 0.03}s` }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm truncate">{sim.simulation_name}</p>
                <FFPBadge status={sim.overall_ffp_status} />
                {sim.is_public && <Badge variant="violet">Public</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{sim.club_name}</span>
                <span>·</span>
                <span>{sim.window_type === 'summer' ? '☀️' : '❄️'} {sim.season}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(sim.created_at)}</span>
              </div>
              <div className="flex gap-3 mt-1.5 text-xs">
                {sim.total_buys > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{sim.total_buys} buys</span>}
                {sim.total_sells > 0 && <span className="text-red-500">-{sim.total_sells} sells</span>}
                {sim.total_loans_in > 0 && <span className="text-violet-500">{sim.total_loans_in} loans in</span>}
                {sim.total_loans_out > 0 && <span className="text-orange-500">{sim.total_loans_out} loans out</span>}
                <span className={cn('ml-auto font-medium', sim.net_spend > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
                  Net: {formatEur(sim.net_spend, true)}
                </span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Link href={`/simulations/${sim.id}`}>
                <Button variant="secondary" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>Open</Button>
              </Link>
              <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}
                className="text-muted-foreground hover:text-destructive"
                loading={deleteMutation.isPending}
                onClick={() => { if (confirm('Delete this simulation?')) deleteMutation.mutate(sim.id); }} />
            </div>
          </div>
        ))}
      </div>

      <CreateSimModal open={createOpen} onClose={() => setCreateOpen(false)}
        prefilledClubId={prefilledClubId} prefilledClubName={prefilledClubName} />
    </div>
  );
}

function CreateSimModal({ open, onClose, prefilledClubId, prefilledClubName }: {
  open: boolean; onClose: () => void; prefilledClubId?: number; prefilledClubName?: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [clubId, setClubId] = useState<number | null>(prefilledClubId ?? null);
  const [clubName, setClubName] = useState(prefilledClubName ?? '');
  const [clubSearch, setClubSearch] = useState(prefilledClubName ?? '');
  const [clubResults, setClubResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (prefilledClubId) { setClubId(prefilledClubId); setClubName(prefilledClubName ?? ''); setClubSearch(prefilledClubName ?? ''); }
  }, [prefilledClubId, prefilledClubName]);

  useEffect(() => {
    if (clubSearch.length < 2 || clubId) { setClubResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearchLoading(true);
      try { const r = await searchApi.clubs(clubSearch); setClubResults(r); setDropOpen(true); }
      catch {} finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [clubSearch, clubId]);

  useEffect(() => {
    function h(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<any>({
    defaultValues: { window_type: 'summer', season: `${CURRENT_SEASON}/${String(CURRENT_SEASON + 1).slice(2)}`, is_public: false },
    mode: 'onSubmit',
  });

  const onSubmit = async (data: any) => {
    if (!clubId) { toast.error('Please select a club'); return; }
    try {
      const sim = await simulationsApi.create({
        club_api_football_id: clubId,
        simulation_name: data.simulation_name || `${clubName} Sim`,
        window_type: data.window_type,
        season: data.season,
        is_public: data.is_public === true || data.is_public === 'true',
      });
      qc.invalidateQueries({ queryKey: ['my-sims'] });
      toast.success('Simulation created!');
      router.push(`/simulations/${sim.id}`);
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Simulation" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Club search */}
        <div ref={dropRef} className="relative">
          <label className="block text-sm font-medium mb-1.5">Club <span className="text-destructive">*</span></label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={clubSearch}
              onChange={e => { setClubSearch(e.target.value); setClubId(null); setClubName(''); }}
              placeholder="Search clubs…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
          {clubId && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">✓ {clubName}</p>}
          {dropOpen && clubResults.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in max-h-52 overflow-y-auto">
              {clubResults.slice(0, 8).map((c: any) => (
                <button key={c.api_football_id} type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
                  onClick={() => { setClubId(c.api_football_id); setClubName(c.name); setClubSearch(c.name); setDropOpen(false); setClubResults([]); }}>
                  {c.logo_url && <img src={c.logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />}
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.country} · {c.league}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Simulation Name</label>
          <input {...register('simulation_name')} placeholder={`${clubName || 'Club'} Summer 2025`}
            className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Window</label>
            <select {...register('window_type')} className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="summer">☀️ Summer</option>
              <option value="winter">❄️ Winter</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Season</label>
            <input {...register('season')} placeholder="2025/26"
              className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_public" {...register('is_public')} className="rounded" />
          <label htmlFor="is_public" className="text-sm">Make public (visible to others)</label>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting} disabled={!clubId}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function SimulationsPage() {
  return <Suspense fallback={<PageLoader />}><SimsContent /></Suspense>;
}

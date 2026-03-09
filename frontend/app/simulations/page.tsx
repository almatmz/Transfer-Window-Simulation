'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { simulationsApi } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { Button, Card, Skeleton, ErrorMessage, EmptyState, Badge, Modal, Input, Select } from '@/components/ui';
import { formatEur, formatDate, ffpStatusBg } from '@/lib/utils';
import { Plus, Trash2, BarChart3, ArrowRight, Search, Trophy } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { simulationCreateSchema } from '@/lib/schemas';
import { z } from 'zod';
import type { SimulationSummary } from '@/lib/api/types';

type FormData = z.infer<typeof simulationCreateSchema>;

export default function SimulationsPage() {
  const { isAuthenticated, loading } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [createModal, setCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: sims, isLoading, error, refetch } = useQuery({
    queryKey: ['simulations-my'],
    queryFn: () => simulationsApi.listMy(),
    enabled: isAuthenticated,
  });

  const createMut = useMutation({
    mutationFn: simulationsApi.create,
    onSuccess: (sim) => {
      toast.success('Simulation created!');
      setCreateModal(false);
      qc.invalidateQueries({ queryKey: ['simulations-my'] });
      router.push(`/simulations/${sim.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => simulationsApi.delete(id),
    onSuccess: () => {
      toast.success('Simulation deleted');
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ['simulations-my'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(simulationCreateSchema),
    defaultValues: { window_type: 'summer', season: '2025/26', is_public: false },
  });

  if (!loading && !isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <EmptyState
          icon={<BarChart3 className="w-7 h-7" />}
          title="Sign in to create simulations"
          description="Create a free account to start planning your transfer window"
          action={<Link href="/login"><Button>Sign in</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-black">My Simulations</h1>
            <p className="text-muted-foreground text-sm">Plan and compare transfer windows</p>
          </div>
          <Button onClick={() => setCreateModal(true)}>
            <Plus className="w-4 h-4" /> New Simulation
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        )}

        {error && <ErrorMessage message={(error as Error).message} onRetry={refetch} />}

        {sims && sims.length === 0 && (
          <EmptyState
            icon={<BarChart3 className="w-7 h-7" />}
            title="No simulations yet"
            description="Start by searching for a club and creating your first simulation"
            action={
              <div className="flex gap-2">
                <Link href="/clubs/search"><Button variant="outline"><Search className="w-4 h-4" /> Find a Club</Button></Link>
                <Button onClick={() => setCreateModal(true)}><Plus className="w-4 h-4" /> Quick Create</Button>
              </div>
            }
          />
        )}

        {sims && sims.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence>
              {sims.map((sim: SimulationSummary, i: number) => (
                <motion.div
                  key={sim.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-lg truncate">{sim.simulation_name}</h3>
                          <Badge className={ffpStatusBg(sim.overall_ffp_status)}>
                            {sim.overall_ffp_status}
                          </Badge>
                          {sim.is_public && (
                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Public</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {sim.club_name} · {sim.season} · {sim.window_type === 'summer' ? 'Summer' : 'Winter'} window
                        </p>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Buys: </span>
                            <span className="font-semibold">{sim.total_buys}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Sells: </span>
                            <span className="font-semibold">{sim.total_sells}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Loans In: </span>
                            <span className="font-semibold">{sim.total_loans_in}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Loans Out: </span>
                            <span className="font-semibold">{sim.total_loans_out}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Net Spend: </span>
                            <span className={`font-semibold ${sim.net_spend > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                              {formatEur(sim.net_spend, true)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Created {formatDate(sim.created_at)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setDeleteConfirm(sim.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link href={`/simulations/${sim.id}`}>
                          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Create Modal */}
        <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Simulation">
          <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-4">
            <Input
              label="Club ID (api_football_id)"
              type="number"
              placeholder="e.g. 33 = Man Utd, 541 = Real Madrid"
              error={errors.club_api_football_id?.message}
              helperText="Find the ID from the clubs search page URL"
              {...register('club_api_football_id', { valueAsNumber: true })}
            />
            <Input
              label="Simulation Name"
              placeholder="e.g. Summer 2026 rebuild"
              error={errors.simulation_name?.message}
              {...register('simulation_name')}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Window"
                options={[{ value: 'summer', label: 'Summer' }, { value: 'winter', label: 'Winter' }]}
                {...register('window_type')}
              />
              <Input label="Season" placeholder="2025/26" {...register('season')} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" {...register('is_public')} />
              Make public
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" type="button" onClick={() => setCreateModal(false)}>Cancel</Button>
              <Button type="submit" loading={createMut.isPending}>Create</Button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirm */}
        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Simulation" size="sm">
          <p className="text-muted-foreground mb-4">This action cannot be undone. All transfers in this simulation will be permanently deleted.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" loading={deleteMut.isPending}
              onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm)}>
              Delete
            </Button>
          </div>
        </Modal>
      </motion.div>
    </div>
  );
}

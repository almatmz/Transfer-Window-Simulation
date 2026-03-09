'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { Button, Card, Skeleton, ErrorMessage, Badge, Modal, Input, KpiCard } from '@/components/ui';
import { formatDateTime, ffpStatusBg, roleColor, roleLabel, formatEur } from '@/lib/utils';
import { Users, BarChart3, Plus, RefreshCw, DollarSign, Calendar, Globe, Trophy, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { revenueSchema } from '@/lib/schemas';
import { z } from 'zod';
import { SimulationCreateModal } from '@/components/forms/SimulationCreateModal';

type RevenueFormData = z.infer<typeof revenueSchema>;

export default function ClubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = Number(clubId);
  const { isAuthenticated, role } = useAuth();
  const qc = useQueryClient();
  const [revenueModal, setRevenueModal] = useState(false);
  const [simModal, setSimModal] = useState(false);
  const router = useRouter();

  const { data: club, isLoading, error, refetch } = useQuery({
    queryKey: ['club', id],
    queryFn: () => clubsApi.get(id),
    enabled: !isNaN(id),
  });

  const syncMut = useMutation({
    mutationFn: () => clubsApi.sync(id),
    onSuccess: () => {
      toast.success('Squad sync initiated');
      qc.invalidateQueries({ queryKey: ['club', id] });
      qc.invalidateQueries({ queryKey: ['squad', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revenueMut = useMutation({
    mutationFn: (data: RevenueFormData) => clubsApi.setRevenue(id, data),
    onSuccess: () => {
      toast.success('Revenue updated');
      setRevenueModal(false);
      qc.invalidateQueries({ queryKey: ['club', id] });
      qc.invalidateQueries({ queryKey: ['ffp', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<RevenueFormData>({
    resolver: zodResolver(revenueSchema),
    defaultValues: { season_year: new Date().getFullYear() },
  });

  const canManage = role === 'sport_director' || role === 'admin';

  if (isLoading) return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="flex gap-5 mb-8">
        <Skeleton className="w-24 h-24 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="container mx-auto px-4 py-10">
      <ErrorMessage message={(error as Error).message} onRetry={refetch} />
    </div>
  );

  if (!club) return null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

        {/* Header */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center shrink-0 overflow-hidden shadow-lg">
              {club.logo_url ? (
                <Image src={club.logo_url} alt={club.name} width={64} height={64} className="object-contain" unoptimized />
              ) : (
                <Trophy className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-display font-black">{club.name}</h1>
                  <p className="text-muted-foreground font-medium">{club.short_name}</p>
                </div>
                {canManage && (
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setRevenueModal(true)}>
                      <DollarSign className="w-3.5 h-3.5" /> Set Revenue
                    </Button>
                    <Button variant="outline" size="sm" loading={syncMut.isPending} onClick={() => syncMut.mutate()}>
                      <RefreshCw className="w-3.5 h-3.5" /> Force Sync
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />{club.country}</span>
                <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" />{club.league}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Season {club.season_year}</span>
                <span className="text-muted-foreground/50">Synced: {formatDateTime(club.last_synced_at)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Link href={`/clubs/${id}/squad`}>
            <Card hover className="p-5 flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="font-display font-bold">Squad</p>
                <p className="text-xs text-muted-foreground">View all players</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
            </Card>
          </Link>

          <Link href={`/ffp/${id}`}>
            <Card hover className="p-5 flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-display font-bold">FFP Dashboard</p>
                <p className="text-xs text-muted-foreground">Compliance analysis</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-emerald-500 transition-colors" />
            </Card>
          </Link>

          {isAuthenticated ? (
            <button onClick={() => setSimModal(true)} className="text-left">
              <Card hover className="p-5 flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-display font-bold">New Simulation</p>
                  <p className="text-xs text-muted-foreground">Plan transfers</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
              </Card>
            </button>
          ) : (
            <Link href="/login">
              <Card hover className="p-5 flex items-center gap-4 group opacity-60">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-display font-bold">New Simulation</p>
                  <p className="text-xs text-muted-foreground">Sign in to simulate</p>
                </div>
              </Card>
            </Link>
          )}
        </div>

        {/* Revenue Modal */}
        <Modal open={revenueModal} onClose={() => setRevenueModal(false)} title="Set Club Revenue">
          <form onSubmit={handleSubmit(d => revenueMut.mutate(d))} className="space-y-4">
            <Input
              label="Annual Revenue (€)"
              type="number"
              placeholder="e.g. 200000000"
              error={errors.annual_revenue?.message}
              {...register('annual_revenue', { valueAsNumber: true })}
            />
            <Input
              label="Season Year"
              type="number"
              error={errors.season_year?.message}
              {...register('season_year', { valueAsNumber: true })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" type="button" onClick={() => setRevenueModal(false)}>Cancel</Button>
              <Button type="submit" loading={revenueMut.isPending}>Save Revenue</Button>
            </div>
          </form>
        </Modal>

        {/* Simulation Create Modal */}
        {simModal && (
          <SimulationCreateModal
            clubId={id}
            clubName={club.name}
            onClose={() => setSimModal(false)}
            onCreated={(simId) => {
              setSimModal(false);
              router.push(`/simulations/${simId}`);
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

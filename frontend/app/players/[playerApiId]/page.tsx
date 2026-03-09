'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { Button, Card, Skeleton, ErrorMessage, Badge, Input, Modal } from '@/components/ui';
import { formatEur, formatDate, roleColor } from '@/lib/utils';
import { User, DollarSign, Trash2, Edit2, ArrowLeft, Calendar, Globe, Activity } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { salaryOverrideSchema } from '@/lib/schemas';
import { z } from 'zod';
import Link from 'next/link';

type OverrideForm = z.infer<typeof salaryOverrideSchema>;

export default function PlayerPage() {
  const { playerApiId } = useParams<{ playerApiId: string }>();
  const id = Number(playerApiId);
  const { role } = useAuth();
  const qc = useQueryClient();
  const [overrideModal, setOverrideModal] = useState(false);
  const canManage = role === 'sport_director' || role === 'admin';

  const { data: player, isLoading, error, refetch } = useQuery({
    queryKey: ['player', id],
    queryFn: () => playersApi.get(id),
  });

  const overrideMut = useMutation({
    mutationFn: (data: OverrideForm) => playersApi.setSalaryOverride(id, data),
    onSuccess: () => {
      toast.success('Salary override saved');
      setOverrideModal(false);
      qc.invalidateQueries({ queryKey: ['player', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => playersApi.deleteSalaryOverride(id),
    onSuccess: () => {
      toast.success('Salary override removed');
      qc.invalidateQueries({ queryKey: ['player', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<OverrideForm>({
    resolver: zodResolver(salaryOverrideSchema),
    defaultValues: { acquisition_fee: 0, acquisition_year: 0, notes: '' },
  });

  if (isLoading) return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="flex gap-5 mb-6">
        <Skeleton className="w-24 h-24 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="container mx-auto px-4 py-10">
      <ErrorMessage message={(error as Error).message} onRetry={refetch} />
    </div>
  );

  if (!player) return null;

  const p = player as Record<string, unknown>;
  const name = String(p.name ?? p.firstname ?? 'Unknown Player');
  const photo = String(p.photo_url ?? p.photo ?? '');
  const position = String(p.position ?? '');
  const age = p.age as number | undefined;
  const nationality = String(p.nationality ?? '');
  const salary = (p.annual_salary ?? p.estimated_salary) as number | undefined;
  const override = p.salary_override as Record<string, unknown> | undefined;
  const clubName = String(p.club_name ?? '');
  const contractExpiry = p.contract_expiry_year as number | undefined;

  // Display all "extra" fields
  const knownKeys = new Set(['name', 'firstname', 'lastname', 'photo_url', 'photo', 'position',
    'age', 'nationality', 'annual_salary', 'estimated_salary', 'salary_override',
    'club_name', 'contract_expiry_year', 'api_football_id', 'id']);
  const extraFields = Object.entries(p).filter(([k]) => !knownKeys.has(k) && p[k] !== null && p[k] !== '');

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="javascript:history.back()" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {/* Player Header */}
        <Card className="p-6 mb-4">
          <div className="flex gap-5">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {photo ? (
                <Image src={photo} alt={name} width={80} height={80} className="object-cover" unoptimized />
              ) : (
                <User className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-black">{name}</h1>
              {position && (
                <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-md mt-1">
                  {position}
                </span>
              )}
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                {nationality && <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />{nationality}</span>}
                {age && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Age {age}</span>}
                {clubName && <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />{clubName}</span>}
              </div>
            </div>
          </div>
        </Card>

        {/* Financial */}
        <Card className="p-5 mb-4">
          <h2 className="font-display font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Financial Data
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Est. Annual Salary</p>
              <p className="text-xl font-display font-bold mt-0.5">{salary ? formatEur(salary, true) : '—'}</p>
            </div>
            {contractExpiry && (
              <div>
                <p className="text-xs text-muted-foreground">Contract Until</p>
                <p className="text-xl font-display font-bold mt-0.5">{contractExpiry}</p>
              </div>
            )}
            {override && (
              <div className="col-span-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs font-semibold text-amber-500 mb-1">SALARY OVERRIDE SET</p>
                <p className="font-display font-bold">{formatEur(override.annual_salary as number, true)}/yr</p>
                <p className="text-xs text-muted-foreground">Expires {override.contract_expiry_year as number} · {override.contract_length_years as number} yr contract</p>
                {override.notes && <p className="text-xs text-muted-foreground mt-1">{override.notes as string}</p>}
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setOverrideModal(true)}>
                <Edit2 className="w-3.5 h-3.5" /> Set Salary Override
              </Button>
              {override && (
                <Button variant="destructive" size="sm" loading={deleteMut.isPending}
                  onClick={() => deleteMut.mutate()}>
                  <Trash2 className="w-3.5 h-3.5" /> Remove Override
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Extra fields */}
        {extraFields.length > 0 && (
          <Card className="p-5">
            <h2 className="font-display font-bold mb-3">Additional Data</h2>
            <div className="grid grid-cols-2 gap-2">
              {extraFields.map(([key, val]) => (
                <div key={key} className="p-2 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-medium mt-0.5 truncate">{String(val)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Salary Override Modal */}
        <Modal open={overrideModal} onClose={() => setOverrideModal(false)} title="Set Salary Override">
          <form onSubmit={handleSubmit(d => overrideMut.mutate(d))} className="space-y-4">
            <Input label="Annual Salary (€)" type="number" error={errors.annual_salary?.message}
              {...register('annual_salary', { valueAsNumber: true })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Contract Length (years)" type="number" error={errors.contract_length_years?.message}
                {...register('contract_length_years', { valueAsNumber: true })} />
              <Input label="Contract Expiry Year" type="number" error={errors.contract_expiry_year?.message}
                {...register('contract_expiry_year', { valueAsNumber: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Acquisition Fee (€)" type="number"
                {...register('acquisition_fee', { valueAsNumber: true })} />
              <Input label="Acquisition Year" type="number"
                {...register('acquisition_year', { valueAsNumber: true })} />
            </div>
            <Input label="Notes (optional)"
              {...register('notes')} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" type="button" onClick={() => setOverrideModal(false)}>Cancel</Button>
              <Button type="submit" loading={overrideMut.isPending}>Save Override</Button>
            </div>
          </form>
        </Modal>
      </motion.div>
    </div>
  );
}

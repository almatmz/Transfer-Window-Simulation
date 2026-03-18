'use client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { squadOverridesApi } from '@/lib/api/client';
import { Button, Modal } from '@/components/ui';
import { PlayerSearchField } from './PlayerSearchField';

interface Props { open: boolean; onClose: () => void; clubId: number; clubName?: string; season: number; }

export function AddPlayerModal({ open, onClose, clubId, clubName, season }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<any>({
    defaultValues: { season_year: season, position: 'Midfielder', loan_status: 'none' },
    mode: 'onSubmit',
  });
  const loanStatus = watch('loan_status');

  const handlePick = (p: any) => {
    if (p.name)                                       setValue('player_name', p.name);
    if (p.position)                                   setValue('position', p.position);
    if (p.age)                                        setValue('age', p.age);
    if (p.nationality)                                setValue('nationality', p.nationality);
    const sal = p.estimated_annual_salary ?? p.annual_salary;
    if (sal)                                          setValue('annual_salary', sal);
    if (p.transfer_value)                             setValue('transfer_value', p.transfer_value);
    if (p.contract_expiry_year)                       setValue('contract_expiry_year', p.contract_expiry_year);
    if (p.api_football_id && p.api_football_id > 0)  setValue('api_football_player_id', p.api_football_id);
    toast.success(`Auto-filled: ${p.name}`);
  };

  const onSubmit = async (data: any) => {
    const isLoanIn = data.loan_status === 'loan_in';
    try {
      await squadOverridesApi.create(clubId, {
        action: 'add',
        season_year: parseInt(data.season_year),
        api_football_player_id: data.api_football_player_id ? parseInt(data.api_football_player_id) : null,
        player_name: data.player_name,
        position: data.position,
        age: data.age ? parseInt(data.age) : null,
        nationality: data.nationality,
        annual_salary: data.annual_salary ? parseFloat(data.annual_salary) : 0,
        transfer_value: data.transfer_value ? parseFloat(data.transfer_value) : 0,
        contract_expiry_year: data.contract_expiry_year ? parseInt(data.contract_expiry_year) : 0,
        is_on_loan: isLoanIn,
        loan_from_club: isLoanIn ? data.loan_from_club : null,
        notes: [data.notes, data.loan_status === 'loaned_out' ? `Loaned out to: ${data.loaned_out_to}` : ''].filter(Boolean).join(' | '),
      });
      qc.removeQueries({ queryKey: ['squad', clubId] });
      toast.success(`${data.player_name} added to squad`);
      reset(); onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  const inp = "w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <Modal open={open} onClose={onClose} title="Add Player to Squad" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Search any club to auto-fill player details</p>
          <PlayerSearchField onSelect={handlePick} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">Player Name <span className="text-destructive">*</span></label>
            <input {...register('player_name', { required: true })} placeholder="Full name" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Position</label>
            <select {...register('position')} className="w-full h-9 px-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              {['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Season Year</label>
            <input type="number" {...register('season_year')} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Age</label>
            <input type="number" {...register('age')} placeholder="e.g. 18" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nationality</label>
            <input {...register('nationality')} placeholder="e.g. Brazilian" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Annual Salary (€)</label>
            <input type="number" {...register('annual_salary')} placeholder="e.g. 6000000" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Transfer Value (€)</label>
            <input type="number" {...register('transfer_value')} placeholder="e.g. 80000000" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Contract Expiry Year</label>
            <input type="number" {...register('contract_expiry_year')} placeholder="e.g. 2029" className={inp} />
          </div>
        </div>

        {/* Loan direction */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold">Loan Status</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'none',       label: '✅ Owns player',  desc: 'No loan' },
              { value: 'loaned_out', label: '📤 Loaned OUT',   desc: `${clubName ?? 'Club'} owns, away` },
              { value: 'loan_in',    label: '📥 Loan IN',      desc: 'Borrowed from another club' },
            ].map(opt => (
              <label key={opt.value} className={`flex flex-col gap-0.5 p-3 rounded-xl border cursor-pointer transition-all ${loanStatus === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
                <input type="radio" {...register('loan_status')} value={opt.value} className="sr-only" />
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
              </label>
            ))}
          </div>
          {loanStatus === 'loaned_out' && (
            <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-2">Player is registered here but plays elsewhere on loan.</p>
              <input {...register('loaned_out_to')} placeholder="Loaned out to (e.g. Olympique Lyon)" className={inp} />
            </div>
          )}
          {loanStatus === 'loan_in' && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">Player is owned elsewhere and plays here on loan.</p>
              <input {...register('loan_from_club')} placeholder="On loan from (e.g. FC Barcelona)" className={inp} />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Notes</label>
          <textarea {...register('notes')} rows={2} placeholder="Optional notes…"
            className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting} icon={<Plus className="w-3.5 h-3.5" />}>Add to Squad</Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { simulationsApi } from '@/lib/api/client';
import { Button, Card, Skeleton, ErrorMessage, Badge, Tabs, Modal, Input, Select, KpiCard } from '@/components/ui';
import { formatEur, formatDate, ffpStatusBg } from '@/lib/utils';
import { SimProjectionChart } from '@/components/charts/FFPChart';
import {
  Trash2, Plus, Edit2, ArrowLeft, ExternalLink, TrendingDown, TrendingUp,
  ShoppingCart, DollarSign, ArrowLeftRight, UserMinus
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addBuySchema, addSellSchema, addLoanInSchema, addLoanOutSchema, updateSimMetaSchema } from '@/lib/schemas';
import { z } from 'zod';
import type { SimulationResponse, BuyEntry, SellEntry, LoanInEntry, LoanOutEntry } from '@/lib/api/types';

type BuyForm = z.infer<typeof addBuySchema>;
type SellForm = z.infer<typeof addSellSchema>;
type LoanInForm = z.infer<typeof addLoanInSchema>;
type LoanOutForm = z.infer<typeof addLoanOutSchema>;
type MetaForm = z.infer<typeof updateSimMetaSchema>;

const positions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'].map(p => ({ value: p, label: p }));

function TransferRow({ children, onDelete, loading }: { children: React.ReactNode; onDelete: () => void; loading?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={onDelete}
        disabled={loading}
        className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function SimulationPage() {
  const { simId } = useParams<{ simId: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('buys');
  const [editModal, setEditModal] = useState(false);
  const [addBuyModal, setAddBuyModal] = useState(false);
  const [addSellModal, setAddSellModal] = useState(false);
  const [addLoanInModal, setAddLoanInModal] = useState(false);
  const [addLoanOutModal, setAddLoanOutModal] = useState(false);

  const { data: sim, isLoading, error, refetch } = useQuery({
    queryKey: ['simulation', simId],
    queryFn: () => simulationsApi.get(simId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['simulation', simId] });

  const mutOpts = (msg: string, closeModal?: () => void) => ({
    onSuccess: (data: SimulationResponse) => {
      toast.success(msg);
      closeModal?.();
      qc.setQueryData(['simulation', simId], data);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const metaMut = useMutation({ mutationFn: (d: MetaForm) => simulationsApi.updateMeta(simId, d), ...mutOpts('Updated', () => setEditModal(false)) });
  const buyMut = useMutation({ mutationFn: (d: BuyForm) => simulationsApi.addBuy(simId, d), ...mutOpts('Player added', () => setAddBuyModal(false)) });
  const removeBuyMut = useMutation({ mutationFn: (i: number) => simulationsApi.removeBuy(simId, i), ...mutOpts('Removed') });
  const sellMut = useMutation({ mutationFn: (d: SellForm) => simulationsApi.addSell(simId, d), ...mutOpts('Player sold', () => setAddSellModal(false)) });
  const removeSellMut = useMutation({ mutationFn: (i: number) => simulationsApi.removeSell(simId, i), ...mutOpts('Removed') });
  const loanInMut = useMutation({ mutationFn: (d: LoanInForm) => simulationsApi.addLoanIn(simId, d), ...mutOpts('Loan in added', () => setAddLoanInModal(false)) });
  const removeLoanInMut = useMutation({ mutationFn: (i: number) => simulationsApi.removeLoanIn(simId, i), ...mutOpts('Removed') });
  const loanOutMut = useMutation({ mutationFn: (d: LoanOutForm) => simulationsApi.addLoanOut(simId, d), ...mutOpts('Loan out added', () => setAddLoanOutModal(false)) });
  const removeLoanOutMut = useMutation({ mutationFn: (i: number) => simulationsApi.removeLoanOut(simId, i), ...mutOpts('Removed') });

  const buyForm = useForm<BuyForm>({ resolver: zodResolver(addBuySchema), defaultValues: { age: 25, transfer_fee: 0, contract_length_years: 3 } });
  const sellForm = useForm<SellForm>({ resolver: zodResolver(addSellSchema), defaultValues: { transfer_fee: 0, annual_salary: 0, contract_length_years: 1 } });
  const loanInForm = useForm<LoanInForm>({ resolver: zodResolver(addLoanInSchema), defaultValues: { wage_contribution_pct: 50, loan_fee: 0, contract_length_years: 1, has_option_to_buy: false } });
  const loanOutForm = useForm<LoanOutForm>({ resolver: zodResolver(addLoanOutSchema), defaultValues: { wage_contribution_pct: 0, loan_fee_received: 0, contract_length_years: 1, has_option_to_sell: false } });
  const metaForm = useForm<MetaForm>({ resolver: zodResolver(updateSimMetaSchema) });

  if (isLoading) return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-4">
      <Skeleton className="h-32" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="container mx-auto px-4 py-10">
      <ErrorMessage message={(error as Error).message} onRetry={refetch} />
    </div>
  );

  if (!sim) return null;

  const tabs = [
    { id: 'buys', label: 'Buys', count: sim.buys.length },
    { id: 'sells', label: 'Sells', count: sim.sells.length },
    { id: 'loans-in', label: 'Loans In', count: sim.loans_in.length },
    { id: 'loans-out', label: 'Loans Out', count: sim.loans_out.length },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <Link href="/simulations" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-2 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Simulations
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-black">{sim.simulation_name}</h1>
              <Badge className={ffpStatusBg(sim.overall_ffp_status)}>{sim.overall_ffp_status}</Badge>
              {sim.used_salary_overrides && (
                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Real salaries</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {sim.club_name} · {sim.season} · {sim.window_type === 'summer' ? '☀️ Summer' : '❄️ Winter'} window
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { metaForm.reset({ simulation_name: sim.simulation_name, window_type: sim.window_type, season: sim.season, is_public: sim.is_public }); setEditModal(true); }}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
              <Edit2 className="w-4 h-4" />
            </button>
            <Link href={`/ffp/${sim.club_api_football_id}?sim_id=${sim.id}`}>
              <button className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                <ExternalLink className="w-3.5 h-3.5" /> FFP Overlay
              </button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Total Buy Fees" value={formatEur(sim.total_buy_fees, true)} icon={<ShoppingCart className="w-4 h-4" />} />
          <KpiCard label="Total Sell Fees" value={formatEur(sim.total_sell_fees, true)} icon={<TrendingUp className="w-4 h-4" />} />
          <KpiCard
            label="Net Spend"
            value={formatEur(sim.net_spend, true)}
            icon={<DollarSign className="w-4 h-4" />}
            className={sim.net_spend > 0 ? 'border-red-500/20' : 'border-emerald-500/20'}
          />
          <KpiCard
            label="Loan Balance"
            value={formatEur(sim.total_loan_fees_received - sim.total_loan_fees_paid, true)}
            icon={<ArrowLeftRight className="w-4 h-4" />}
          />
        </div>

        {/* Transfer Tabs */}
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <Tabs items={tabs} active={activeTab} onChange={setActiveTab} />
            <Button size="sm" onClick={() => {
              if (activeTab === 'buys') setAddBuyModal(true);
              else if (activeTab === 'sells') setAddSellModal(true);
              else if (activeTab === 'loans-in') setAddLoanInModal(true);
              else setAddLoanOutModal(true);
            }}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'buys' && (
              <motion.div key="buys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {sim.buys.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No buys yet. Click Add to sign a player.</p>
                ) : (
                  <div className="space-y-2">
                    {sim.buys.map((b: BuyEntry, i: number) => (
                      <TransferRow key={i} onDelete={() => removeBuyMut.mutate(i)} loading={removeBuyMut.isPending}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="font-semibold">{b.player_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{b.position} · Age {b.age}</span>
                          </div>
                          <div className="flex gap-3 text-sm">
                            <span className="text-muted-foreground">Fee: <span className="font-medium text-foreground">{formatEur(b.transfer_fee, true)}</span></span>
                            <span className="text-muted-foreground">Salary: <span className="font-medium text-foreground">{formatEur(b.annual_salary, true)}/yr</span></span>
                            <span className="text-muted-foreground">{b.contract_length_years}yr</span>
                          </div>
                        </div>
                      </TransferRow>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'sells' && (
              <motion.div key="sells" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {sim.sells.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No sells yet. Click Add to sell a player.</p>
                ) : (
                  <div className="space-y-2">
                    {sim.sells.map((s: SellEntry, i: number) => (
                      <TransferRow key={i} onDelete={() => removeSellMut.mutate(i)} loading={removeSellMut.isPending}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="font-semibold">{s.player_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{s.position}</span>
                          </div>
                          <span className="text-sm">Fee: <span className="font-medium text-emerald-500">{formatEur(s.transfer_fee, true)}</span></span>
                        </div>
                      </TransferRow>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'loans-in' && (
              <motion.div key="loans-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {sim.loans_in.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No loans in yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sim.loans_in.map((l: LoanInEntry, i: number) => (
                      <TransferRow key={i} onDelete={() => removeLoanInMut.mutate(i)} loading={removeLoanInMut.isPending}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="font-semibold">{l.player_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{l.position}</span>
                          </div>
                          <div className="flex gap-3 text-sm">
                            <span className="text-muted-foreground">Your wage: <span className="font-medium text-foreground">{l.wage_contribution_pct}%</span></span>
                            <span className="text-muted-foreground">Salary: <span className="font-medium text-foreground">{formatEur(l.annual_salary, true)}/yr</span></span>
                            {l.has_option_to_buy && <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">OTB</Badge>}
                          </div>
                        </div>
                      </TransferRow>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'loans-out' && (
              <motion.div key="loans-out" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {sim.loans_out.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No loans out yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sim.loans_out.map((l: LoanOutEntry, i: number) => (
                      <TransferRow key={i} onDelete={() => removeLoanOutMut.mutate(i)} loading={removeLoanOutMut.isPending}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="font-semibold">{l.player_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{l.position}</span>
                          </div>
                          <div className="flex gap-3 text-sm">
                            <span className="text-muted-foreground">Still paying: <span className={`font-medium ${(l.wage_contribution_pct ?? 0) === 0 ? 'text-emerald-500' : 'text-foreground'}`}>{l.wage_contribution_pct}%</span></span>
                            {l.loan_fee_received ? <span className="text-muted-foreground">Fee rcvd: <span className="font-medium text-emerald-500">{formatEur(l.loan_fee_received, true)}</span></span> : null}
                          </div>
                        </div>
                      </TransferRow>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Projections chart */}
        {sim.projections.length > 0 && (
          <Card className="p-5">
            <h3 className="font-display font-bold mb-4">Simulation Projections</h3>
            <SimProjectionChart projections={sim.projections} />
          </Card>
        )}

        {/* ─── MODALS ─────────────────────────────────────── */}

        {/* Edit Meta */}
        <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Simulation">
          <form onSubmit={metaForm.handleSubmit(d => metaMut.mutate(d))} className="space-y-4">
            <Input label="Name" error={metaForm.formState.errors.simulation_name?.message} {...metaForm.register('simulation_name')} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Window" options={[{ value: 'summer', label: 'Summer' }, { value: 'winter', label: 'Winter' }]} {...metaForm.register('window_type')} />
              <Input label="Season" {...metaForm.register('season')} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...metaForm.register('is_public')} />
              Public
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" type="button" onClick={() => setEditModal(false)}>Cancel</Button>
              <Button type="submit" loading={metaMut.isPending}>Save</Button>
            </div>
          </form>
        </Modal>

        {/* Add Buy */}
        <Modal open={addBuyModal} onClose={() => setAddBuyModal(false)} title="Add Player Buy" size="lg">
          <form onSubmit={buyForm.handleSubmit(d => buyMut.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Player Name" error={buyForm.formState.errors.player_name?.message} {...buyForm.register('player_name')} />
              <Select label="Position" options={positions} {...buyForm.register('position')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Age" type="number" error={buyForm.formState.errors.age?.message} {...buyForm.register('age', { valueAsNumber: true })} />
              <Input label="Transfer Fee (€)" type="number" error={buyForm.formState.errors.transfer_fee?.message} {...buyForm.register('transfer_fee', { valueAsNumber: true })} />
              <Input label="Contract (years)" type="number" {...buyForm.register('contract_length_years', { valueAsNumber: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Annual Salary (€)" type="number" error={buyForm.formState.errors.annual_salary?.message} {...buyForm.register('annual_salary', { valueAsNumber: true })} />
              <Input label="Nationality (opt.)" {...buyForm.register('nationality')} />
            </div>
            <Input label="API Football Player ID (opt.)" type="number" {...buyForm.register('api_football_player_id', { valueAsNumber: true, setValueAs: v => v === '' || isNaN(v) ? null : v })} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setAddBuyModal(false)}>Cancel</Button>
              <Button type="submit" loading={buyMut.isPending}><Plus className="w-3.5 h-3.5" /> Add Buy</Button>
            </div>
          </form>
        </Modal>

        {/* Add Sell */}
        <Modal open={addSellModal} onClose={() => setAddSellModal(false)} title="Add Player Sale" size="lg">
          <form onSubmit={sellForm.handleSubmit(d => sellMut.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Player Name" error={sellForm.formState.errors.player_name?.message} {...sellForm.register('player_name')} />
              <Select label="Position" options={positions} {...sellForm.register('position')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Transfer Fee (€)" type="number" error={sellForm.formState.errors.transfer_fee?.message} {...sellForm.register('transfer_fee', { valueAsNumber: true })} />
              <Input label="Annual Salary (€)" type="number" {...sellForm.register('annual_salary', { valueAsNumber: true })} />
            </div>
            <Input label="API Football Player ID (opt.)" type="number" {...sellForm.register('api_football_player_id', { valueAsNumber: true, setValueAs: v => v === '' || isNaN(v) ? null : v })} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setAddSellModal(false)}>Cancel</Button>
              <Button type="submit" loading={sellMut.isPending}><TrendingDown className="w-3.5 h-3.5" /> Add Sale</Button>
            </div>
          </form>
        </Modal>

        {/* Add Loan In */}
        <Modal open={addLoanInModal} onClose={() => setAddLoanInModal(false)} title="Add Loan In" size="lg">
          <form onSubmit={loanInForm.handleSubmit(d => loanInMut.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Player Name" error={loanInForm.formState.errors.player_name?.message} {...loanInForm.register('player_name')} />
              <Select label="Position" options={positions} {...loanInForm.register('position')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Annual Salary (€)" type="number" error={loanInForm.formState.errors.annual_salary?.message} {...loanInForm.register('annual_salary', { valueAsNumber: true })} />
              <Input label="Your wage % (0-100)" type="number" {...loanInForm.register('wage_contribution_pct', { valueAsNumber: true })} />
              <Input label="Loan Fee (€)" type="number" {...loanInForm.register('loan_fee', { valueAsNumber: true })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Contract (years, 1-3)" type="number" {...loanInForm.register('contract_length_years', { valueAsNumber: true })} />
              <Input label="Age (opt.)" type="number" {...loanInForm.register('age', { valueAsNumber: true, setValueAs: v => v === '' || isNaN(v) ? null : v })} />
              <Input label="API Football ID (opt.)" type="number" {...loanInForm.register('api_football_player_id', { valueAsNumber: true, setValueAs: v => v === '' || isNaN(v) ? null : v })} />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                <input type="checkbox" {...loanInForm.register('has_option_to_buy')} />
                Has option to buy
              </label>
              {loanInForm.watch('has_option_to_buy') && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Input label="OTB Fee (€)" type="number" {...loanInForm.register('option_to_buy_fee', { valueAsNumber: true })} />
                  <Input label="OTB Year" type="number" {...loanInForm.register('option_to_buy_year', { valueAsNumber: true })} />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setAddLoanInModal(false)}>Cancel</Button>
              <Button type="submit" loading={loanInMut.isPending}><Plus className="w-3.5 h-3.5" /> Add Loan In</Button>
            </div>
          </form>
        </Modal>

        {/* Add Loan Out */}
        <Modal open={addLoanOutModal} onClose={() => setAddLoanOutModal(false)} title="Add Loan Out" size="lg">
          <form onSubmit={loanOutForm.handleSubmit(d => loanOutMut.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Player Name" error={loanOutForm.formState.errors.player_name?.message} {...loanOutForm.register('player_name')} />
              <Select label="Position" options={positions} {...loanOutForm.register('position')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Annual Salary (€)" type="number" {...loanOutForm.register('annual_salary', { valueAsNumber: true })} />
              <Input label="Still paying % (0=off books)" type="number" {...loanOutForm.register('wage_contribution_pct', { valueAsNumber: true })} />
              <Input label="Loan Fee Received (€)" type="number" {...loanOutForm.register('loan_fee_received', { valueAsNumber: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Contract (years, 1-3)" type="number" {...loanOutForm.register('contract_length_years', { valueAsNumber: true })} />
              <Input label="API Football ID (opt.)" type="number" {...loanOutForm.register('api_football_player_id', { valueAsNumber: true, setValueAs: v => v === '' || isNaN(v) ? null : v })} />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                <input type="checkbox" {...loanOutForm.register('has_option_to_sell')} />
                Has option to sell
              </label>
              {loanOutForm.watch('has_option_to_sell') && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Input label="OTS Fee (€)" type="number" {...loanOutForm.register('option_to_sell_fee', { valueAsNumber: true })} />
                  <Input label="OTS Year" type="number" {...loanOutForm.register('option_to_sell_year', { valueAsNumber: true })} />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setAddLoanOutModal(false)}>Cancel</Button>
              <Button type="submit" loading={loanOutMut.isPending}><UserMinus className="w-3.5 h-3.5" /> Add Loan Out</Button>
            </div>
          </form>
        </Modal>
      </motion.div>
    </div>
  );
}

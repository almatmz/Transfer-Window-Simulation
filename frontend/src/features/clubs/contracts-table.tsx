'use client'
import { useState } from 'react'
import { useContracts, useExtendContract } from '@/services/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { PageSpinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { formatEur } from '@/lib/utils'
import { FileText, Edit2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from '@/components/ui/toaster'

export function ContractsTable({ clubId }: { clubId: number }) {
  const { data: contracts, isLoading } = useContracts(clubId)
  const extendContract = useExtendContract(clubId)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [extendModal, setExtendModal] = useState<{ id: string; name: string } | null>(null)
  const [extendForm, setExtendForm] = useState({ expiry: '', salary: '' })

  if (isLoading) return <PageSpinner />

  const handleExtend = async () => {
    if (!extendModal) return
    try {
      await extendContract.mutateAsync({ contractId: extendModal.id, expiry: parseInt(extendForm.expiry), salary: parseFloat(extendForm.salary) })
      toast('Contract extended successfully', 'success')
      setExtendModal(null)
    } catch {
      toast('Failed to extend contract', 'error')
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Active Contracts ({contracts?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!contracts?.length ? (
            <EmptyState icon={FileText} title="No contracts" description="No active contracts found for this club." />
          ) : (
            <div className="divide-y divide-slate-800/50">
              {contracts.map(c => (
                <div key={c.id}>
                  <div
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/20 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                        {c.player_name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{c.player_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{c.contract_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="hidden sm:block text-right">
                        <p className="text-slate-300 font-medium">{formatEur(c.annual_salary, true)}</p>
                        <p className="text-xs text-slate-600">/year</p>
                      </div>
                      <div className="hidden md:block text-right">
                        <p className={c.contract_expiry_year - 2025 <= 1 ? 'text-red-400' : c.contract_expiry_year - 2025 <= 2 ? 'text-amber-400' : 'text-slate-400'}>
                          {c.contract_expiry_year}
                        </p>
                        <p className="text-xs text-slate-600">expiry</p>
                      </div>
                      <Badge variant={c.data_source === 'override' ? 'success' : 'outline'} className="hidden lg:flex">{c.data_source}</Badge>
                      {expanded === c.id ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                    </div>
                  </div>

                  {expanded === c.id && (
                    <div className="px-6 pb-4 bg-slate-900/30">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-sm border-t border-slate-800/50">
                        {[
                          ['Acquisition Fee', formatEur(c.acquisition_fee, true)],
                          ['Amortization / yr', formatEur(c.amortization_per_year, true)],
                          ['Book Value', formatEur(c.remaining_book_value, true)],
                          ['Wage Contrib.', `${c.loan_wage_contribution_pct}%`],
                        ].map(([label, value]) => (
                          <div key={label as string}>
                            <p className="text-xs text-slate-600 mb-0.5">{label}</p>
                            <p className="font-medium text-slate-300">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => { setExtendModal({ id: c.id, name: c.player_name }); setExtendForm({ expiry: String(c.contract_expiry_year + 2), salary: String(c.annual_salary) }) }}>
                          <Edit2 className="w-3 h-3" /> Extend
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={!!extendModal} onClose={() => setExtendModal(null)} title={`Extend Contract — ${extendModal?.name}`} size="sm">
        <div className="space-y-4">
          <Input label="New Expiry Year" type="number" value={extendForm.expiry} onChange={e => setExtendForm(f => ({ ...f, expiry: e.target.value }))} />
          <Input label="New Annual Salary (€)" type="number" value={extendForm.salary} onChange={e => setExtendForm(f => ({ ...f, salary: e.target.value }))} />
          <p className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
            Amortization will be recalculated as: remaining book value ÷ new years remaining.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setExtendModal(null)}>Cancel</Button>
            <Button loading={extendContract.isPending} onClick={handleExtend}>Extend Contract</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

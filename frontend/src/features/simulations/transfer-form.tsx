'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAddTransfer } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TransferType } from '@/types'

const schema = z.object({
  type: z.enum(['buy', 'sell', 'loan_in', 'loan_out']),
  player_name: z.string().min(1, 'Required'),
  position: z.string().default('UNKNOWN'),
  age: z.coerce.number().min(0).max(50).default(0),
  transfer_fee: z.coerce.number().min(0).default(0),
  annual_salary: z.coerce.number().min(0).default(0),
  contract_length_years: z.coerce.number().min(1).max(10).default(1),
  loan_fee: z.coerce.number().min(0).default(0),
  loan_fee_received: z.coerce.number().min(0).default(0),
  loan_wage_contribution_pct: z.coerce.number().min(0).max(100).default(50),
  option_to_buy_enabled: z.boolean().default(false),
  option_to_buy_fee: z.coerce.number().min(0).default(0),
})

type FormData = z.infer<typeof schema>

const transferTypeLabels: Record<TransferType, string> = {
  buy: '🔵 Buy Player', sell: '🟢 Sell Player',
  loan_in: '🟣 Loan In', loan_out: '🟠 Loan Out',
}

export function TransferForm({ simId }: { simId: string }) {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'buy', contract_length_years: 1, loan_wage_contribution_pct: 50 },
  })
  const addTransfer = useAddTransfer(simId)
  const transferType = watch('type')
  const optionEnabled = watch('option_to_buy_enabled')

  const onSubmit = async (data: FormData) => {
    await addTransfer.mutateAsync(data as Record<string, unknown>)
    reset()
  }

  return (
    <Card>
      <CardHeader><CardTitle>Add Transfer</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" {...register('type')}>
              {Object.entries(transferTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select label="Position" {...register('position')}>
              {['UNKNOWN','GK','CB','LB','RB','CDM','CM','CAM','LW','RW','CF','ST'].map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Player Name" placeholder="e.g. Vinicius Jr." {...register('player_name')} error={errors.player_name?.message} />
            <Input label="Age" type="number" placeholder="25" {...register('age')} />
          </div>

          {/* BUY / SELL fields */}
          {(transferType === 'buy' || transferType === 'sell') && (
            <Input label="Transfer Fee (€)" type="number" placeholder="50000000" {...register('transfer_fee')} />
          )}

          {/* BUY fields */}
          {transferType === 'buy' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Annual Salary (€)" type="number" placeholder="10000000" {...register('annual_salary')} error={errors.annual_salary?.message} />
              <Input label="Contract Years" type="number" placeholder="4" {...register('contract_length_years')} />
            </div>
          )}

          {/* LOAN fields */}
          {(transferType === 'loan_in' || transferType === 'loan_out') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Annual Salary (€)" type="number" placeholder="5000000" {...register('annual_salary')} />
                <Input
                  label={transferType === 'loan_in' ? 'Your Wage % (50=split)' : 'Your Wage % (0=full relief)'}
                  type="number" placeholder="50" {...register('loan_wage_contribution_pct')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {transferType === 'loan_in' && <Input label="Loan Fee Paid (€)" type="number" placeholder="0" {...register('loan_fee')} />}
                {transferType === 'loan_out' && <Input label="Loan Fee Received (€)" type="number" placeholder="0" {...register('loan_fee_received')} />}
              </div>
              {transferType === 'loan_in' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                    <input type="checkbox" {...register('option_to_buy_enabled')} className="rounded border-slate-600" />
                    Include option to buy
                  </label>
                  {optionEnabled && (
                    <Input label="Option to Buy Fee (€)" type="number" placeholder="40000000" {...register('option_to_buy_fee')} />
                  )}
                </div>
              )}
            </>
          )}

          <Button type="submit" loading={addTransfer.isPending} className="w-full">
            Add Transfer
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

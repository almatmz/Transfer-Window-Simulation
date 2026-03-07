'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '@/services/api/auth'
import { useAuthStore } from '@/store/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Trophy, TrendingUp, Shield, BarChart3 } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
})

const features = [
  { icon: TrendingUp,  label: 'Transfer Simulation',     desc: 'Model signings and departures with full financial impact' },
  { icon: BarChart3,   label: 'FFP Analysis',            desc: 'Real-time UEFA Financial Sustainability compliance' },
  { icon: Shield,      label: 'Break-Even Tracking',     desc: '3-year rolling loss monitoring and projections' },
]

export default function LoginPage() {
  const router = useRouter()
  const { setTokens, setUser } = useAuthStore()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data: { email: string; password: string }) => {
    setError('')
    try {
      const tokens = await authApi.login(data.email, data.password)
      setTokens(tokens.access_token, tokens.refresh_token, tokens.role)
      const user = await authApi.me()
      setUser(user)
      router.push('/dashboard')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--c-bg)' }}>
      {/* Left panel — feature showcase */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: 'var(--c-sidebar-bg)' }}>
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
        <div className="absolute -bottom-16 right-0 w-72 h-72 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-900/40">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Transfer Window</p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Financial Simulator</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            Professional Football<br />Finance Platform
          </h1>
          <p className="text-sm leading-relaxed mb-12" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Simulate transfer windows, model wage structures, and ensure UEFA Financial Sustainability compliance.
          </p>

          <div className="space-y-5">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] relative z-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © 2025 Transfer Window Simulator
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold c-text">Transfer Window</h1>
            <p className="text-sm c-text-3">Financial Simulator</p>
          </div>

          <div className="tw-card p-8 shadow-xl">
            <div className="mb-7">
              <h2 className="text-xl font-bold c-text">Sign in</h2>
              <p className="text-sm mt-1 c-text-3">Welcome back — enter your credentials</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input label="Email" type="email" placeholder="you@club.com" {...register('email')} error={errors.email?.message} />
              <Input label="Password" type="password" placeholder="••••••••" {...register('password')} error={errors.password?.message} />

              {error && (
                <div className="rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              <Button type="submit" loading={isSubmitting} className="w-full mt-2" size="lg">
                Sign in
              </Button>
            </form>

            <p className="text-center text-sm c-text-3 mt-5">
              No account?{' '}
              <Link href="/register" className="text-blue-500 dark:text-blue-400 hover:underline font-medium">
                Create one →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

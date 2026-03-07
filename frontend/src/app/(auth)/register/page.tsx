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
import { Trophy } from 'lucide-react'

const schema = z.object({
  email:    z.string().email('Invalid email'),
  username: z.string().min(3, 'Min 3 characters'),
  password: z.string().min(8, 'Min 8 characters'),
  full_name: z.string().optional(),
})

export default function RegisterPage() {
  const router = useRouter()
  const { setTokens, setUser } = useAuthStore()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data: { email: string; username: string; password: string; full_name?: string }) => {
    setError('')
    try {
      const tokens = await authApi.register(data.email, data.username, data.password, data.full_name)
      setTokens(tokens.access_token, tokens.refresh_token, tokens.role)
      const user = await authApi.me()
      setUser(user)
      router.push('/dashboard')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--c-bg)' }}>
      <div className="absolute top-4 right-4"><ThemeToggle /></div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-7">
          <div className="inline-flex w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 items-center justify-center mb-3">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold c-text">Create Account</h1>
          <p className="text-sm c-text-3 mt-0.5">Transfer Window Simulator</p>
        </div>

        <div className="tw-card p-8 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name" placeholder="John Smith" {...register('full_name')} />
              <Input label="Username" placeholder="jsmith" {...register('username')} error={errors.username?.message} />
            </div>
            <Input label="Email" type="email" placeholder="you@club.com" {...register('email')} error={errors.email?.message} />
            <Input label="Password" type="password" placeholder="min 8 characters" {...register('password')} error={errors.password?.message} />

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm c-text-3 mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-500 dark:text-blue-400 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/services/api/auth'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { accessToken, setUser } = useAuthStore()

  useEffect(() => {
    if (!accessToken) { router.replace('/login'); return }
    authApi.me().then(setUser).catch(() => { router.replace('/login') })
  }, [accessToken])

  if (!accessToken) return null
  return <>{children}</>
}

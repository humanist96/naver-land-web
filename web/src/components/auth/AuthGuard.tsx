'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
  requireApproved?: boolean
  requireAdmin?: boolean
}

export function AuthGuard({
  children,
  requireApproved = false,
  requireAdmin = false,
}: AuthGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.replace('/login')
      return
    }

    if (requireAdmin && user.role !== 'admin') {
      router.replace('/search')
      return
    }

    if (requireApproved && user.status !== 'approved') {
      if (user.status === 'pending') {
        router.replace('/pending')
      } else if (user.status === 'rejected') {
        router.replace('/login')
      }
    }
  }, [user, isLoading, requireApproved, requireAdmin, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  if (requireAdmin && user.role !== 'admin') return null
  if (requireApproved && user.status !== 'approved') return null

  return <>{children}</>
}

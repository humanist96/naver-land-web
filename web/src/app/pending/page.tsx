'use client'

import { AuthGuard } from '@/components/auth/AuthGuard'
import { PendingNotice } from '@/components/auth/PendingNotice'

export default function PendingPage() {
  return (
    <AuthGuard>
      <PendingNotice />
    </AuthGuard>
  )
}

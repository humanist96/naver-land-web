import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'
import type { User, UserRole, UserStatus } from '@/types/user'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', authResult.userId)
    .single()

  if (!profile) {
    return NextResponse.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' } },
      { status: 404 }
    )
  }

  const user: User = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    status: profile.status as UserStatus,
    role: profile.role as UserRole,
    approvedAt: profile.approved_at,
    approvedBy: profile.approved_by,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }

  const response: ApiResponse<User> = { success: true, data: user }
  return NextResponse.json(response)
}

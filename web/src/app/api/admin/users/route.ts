import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'
import type { User, UserRole, UserStatus } from '@/types/user'

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  const users: User[] = (profiles || []).map(p => ({
    id: p.id,
    email: p.email,
    name: p.name,
    status: p.status as UserStatus,
    role: p.role as UserRole,
    approvedAt: p.approved_at,
    approvedBy: p.approved_by,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }))

  const response: ApiResponse<User[]> = {
    success: true,
    data: users,
    meta: { total: users.length, page: 1, limit: users.length },
  }
  return NextResponse.json(response)
}

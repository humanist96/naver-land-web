import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' } },
      { status: 404 }
    )
  }

  const response: ApiResponse<typeof data> = {
    success: true,
    data,
    message: '사용자가 거부되었습니다.',
  }
  return NextResponse.json(response)
}

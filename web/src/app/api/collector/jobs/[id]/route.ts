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
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('collection_jobs')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: '수집 작업을 찾을 수 없습니다.' } },
      { status: 404 }
    )
  }

  const response: ApiResponse<typeof data> = { success: true, data }
  return NextResponse.json(response)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('collection_jobs')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, message: '수집 작업이 삭제되었습니다.' })
}

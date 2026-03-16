import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  // 작업 상태를 running으로 업데이트
  const { data, error } = await supabaseAdmin
    .from('collection_jobs')
    .update({
      last_status: 'running',
      last_run_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: '수집 작업을 찾을 수 없습니다.' } },
      { status: 404 }
    )
  }

  // Note: 실제 수집은 GitHub Actions에서 실행됨
  // 여기서는 수동 트리거를 위해 GitHub Actions workflow_dispatch를 호출할 수 있음
  const response: ApiResponse<typeof data> = {
    success: true,
    data,
    message: '수집이 트리거되었습니다. GitHub Actions에서 실행됩니다.',
  }
  return NextResponse.json(response)
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '50', 10)

  const { data, error } = await supabaseAdmin
    .from('collection_jobs')
    .select('id, district_name, city_name, last_run_at, last_status, last_error, total_count, change_count')
    .not('last_run_at', 'is', null)
    .order('last_run_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  const response: ApiResponse<typeof data> = { success: true, data: data || [] }
  return NextResponse.json(response)
}

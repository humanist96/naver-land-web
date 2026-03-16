import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const complexName = url.searchParams.get('name')
  const tradeTypes = url.searchParams.get('tradeTypes')?.split(',').filter(Boolean)

  if (!complexName) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAM', message: '단지명을 입력해주세요.' } },
      { status: 400 }
    )
  }

  let query = supabaseAdmin
    .from('listings')
    .select('*')
    .ilike('atcl_nm', `%${complexName}%`)
    .order('collected_at', { ascending: false })
    .limit(200)

  if (tradeTypes && tradeTypes.length > 0) {
    query = query.in('trade_type', tradeTypes)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  const response: ApiResponse<typeof data> = { success: true, data: data || [] }
  return NextResponse.json(response)
}

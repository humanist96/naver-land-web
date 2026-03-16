import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { collectionJobSchema } from '@/lib/validators'
import type { ApiResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const { data, error } = await supabaseAdmin
    .from('collection_jobs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  const response: ApiResponse<typeof data> = { success: true, data: data || [] }
  return NextResponse.json(response)
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const parsed = collectionJobSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값을 확인해주세요.' } },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('collection_jobs')
      .insert({
        ...parsed.data,
        trade_types: parsed.data.tradeTypes,
        property_types: parsed.data.propertyTypes,
        district_code: parsed.data.districtCode,
        district_name: parsed.data.districtName,
        city_name: parsed.data.cityName,
        is_active: parsed.data.isActive,
        created_by: authResult.userId,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    const response: ApiResponse<typeof data> = { success: true, data }
    return NextResponse.json(response, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    )
  }
}

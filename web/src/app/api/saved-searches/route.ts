import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const { data, error } = await supabaseAdmin
    .from('saved_searches')
    .select('*')
    .eq('user_id', authResult.userId)
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
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const { name, queryParams } = body

    if (!name || !queryParams) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '이름과 검색 조건이 필요합니다.' } },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('saved_searches')
      .insert({
        user_id: authResult.userId,
        name,
        query_params: queryParams,
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

export async function DELETE(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAM', message: 'id가 필요합니다.' } },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', authResult.userId)

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, message: '삭제되었습니다.' })
}

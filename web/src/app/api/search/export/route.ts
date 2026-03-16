import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const district = url.searchParams.get('district')
  const format = url.searchParams.get('format') || 'csv'
  const tradeTypes = url.searchParams.get('tradeTypes')?.split(',').filter(Boolean)

  if (!district) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAM', message: 'district가 필요합니다.' } },
      { status: 400 }
    )
  }

  let query = supabaseAdmin
    .from('listings')
    .select('*')
    .eq('district_name', district)
    .order('collected_at', { ascending: false })
    .limit(2000)

  if (tradeTypes && tradeTypes.length > 0) {
    query = query.in('trade_type', tradeTypes)
  }

  const { data: rows } = await query

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_DATA', message: '내보낼 데이터가 없습니다.' } },
      { status: 404 }
    )
  }

  if (format === 'json') {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${district}_listings.json"`,
      },
    })
  }

  // CSV
  const headers = ['매물번호', '단지명', '거래유형', '매물유형', '지역', '전용면적', '공급면적', '평형', '분류', '가격', '월세', '층', '확인일', '태그']
  const csvRows = rows.map(r => [
    r.atcl_no, r.atcl_nm, r.trade_type, r.property_type,
    `${r.city_name} ${r.district_name}`,
    r.exclusive_area, r.supply_area, r.pyeong, r.size_type,
    r.price_display, r.rent_price || '', r.floor_info || '',
    r.confirm_date || '', (r.tags as string[] || []).join(';'),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const bom = '\uFEFF'
  const csv = bom + headers.join(',') + '\n' + csvRows.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${district}_listings.csv"`,
    },
  })
}

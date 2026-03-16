import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { nlqSchema } from '@/lib/validators'
import { parseNlq } from '@/lib/nlq-parser'
import { formatPriceShort } from '@/domain/price'
import type { ApiResponse } from '@/types/api'

export async function POST(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const parsed = nlqSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '검색어를 확인해주세요.' } },
        { status: 400 }
      )
    }

    const nlqResult = parseNlq(parsed.data.query)

    // DB 쿼리 구성
    let query = supabaseAdmin
      .from('listings')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(500)

    // 단지명 검색
    if (nlqResult.complexName) {
      query = query.ilike('atcl_nm', `%${nlqResult.complexName}%`)
    }

    // 지역 필터
    if (nlqResult.districtName) {
      query = query.eq('district_name', nlqResult.districtName)
    }

    // 거래유형 필터
    if (nlqResult.tradeTypes.length > 0) {
      query = query.in('trade_type', nlqResult.tradeTypes)
    }

    // 평형 필터
    if (nlqResult.sizeType) {
      query = query.eq('size_type', nlqResult.sizeType)
    }

    // 가격 필터
    if (nlqResult.minPrice) {
      query = query.gte('price', nlqResult.minPrice)
    }
    if (nlqResult.maxPrice) {
      query = query.lte('price', nlqResult.maxPrice)
    }

    // 정렬
    if (nlqResult.sort === 'prc') {
      query = query.order('price', { ascending: true })
    } else if (nlqResult.sort === 'spc') {
      query = query.order('exclusive_area', { ascending: false })
    } else if (nlqResult.sort === 'date') {
      query = query.order('confirm_date', { ascending: false })
    }

    const { data: rows, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    // 최신 snapshot만 필터
    const allRows = rows || []
    const latestSnapshot = allRows[0]?.snapshot_id
    const filtered = latestSnapshot
      ? allRows.filter(r => r.snapshot_id === latestSnapshot)
      : allRows

    const listings = filtered.map(r => ({
      atclNo: r.atcl_no,
      atclNm: r.atcl_nm,
      districtCode: r.district_code,
      districtName: r.district_name,
      cityName: r.city_name,
      tradeType: r.trade_type,
      propertyType: r.property_type,
      exclusiveArea: r.exclusive_area,
      supplyArea: r.supply_area,
      pyeong: r.pyeong,
      sizeType: r.size_type,
      price: r.price,
      priceDisplay: r.price_display,
      rentPrice: r.rent_price,
      floorInfo: r.floor_info,
      confirmDate: r.confirm_date,
      tags: r.tags || [],
      lat: r.lat,
      lng: r.lng,
      naverUrl: r.naver_url,
      collectedAt: r.collected_at,
      snapshotId: r.snapshot_id,
    }))

    const totalPrice = listings.reduce((sum, l) => sum + l.price, 0)
    const avgPrice = listings.length > 0 ? Math.round(totalPrice / listings.length) : 0

    const response: ApiResponse<{
      parsed: typeof nlqResult
      listings: typeof listings
      meta: { total: number; avgPrice: number; avgPriceDisplay: string }
    }> = {
      success: true,
      data: {
        parsed: nlqResult,
        listings,
        meta: {
          total: listings.length,
          avgPrice,
          avgPriceDisplay: formatPriceShort(avgPrice),
        },
      },
    }
    return NextResponse.json(response)
  } catch (error) {
    const err = error as Error
    return NextResponse.json(
      { success: false, error: { code: 'SEARCH_ERROR', message: err.message } },
      { status: 500 }
    )
  }
}

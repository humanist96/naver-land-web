import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { searchRegionSchema } from '@/lib/validators'
import { fetchArticles, isKnownDistrict } from '@/lib/naver-api'
import { formatPriceShort } from '@/domain/price'
import type { ApiResponse } from '@/types/api'
import type { Listing, SearchMeta } from '@/types/listing'

function mapDbRow(row: Record<string, unknown>): Listing {
  return {
    atclNo: row.atcl_no as string,
    atclNm: row.atcl_nm as string,
    districtCode: row.district_code as string,
    districtName: row.district_name as string,
    cityName: row.city_name as string,
    tradeType: row.trade_type as string,
    propertyType: row.property_type as string,
    exclusiveArea: row.exclusive_area as number,
    supplyArea: row.supply_area as number,
    pyeong: row.pyeong as number,
    sizeType: row.size_type as string,
    price: row.price as number,
    priceDisplay: row.price_display as string,
    rentPrice: row.rent_price as number | null,
    floorInfo: row.floor_info as string | null,
    confirmDate: row.confirm_date as string | null,
    tags: (row.tags as string[]) || [],
    lat: row.lat as number,
    lng: row.lng as number,
    naverUrl: row.naver_url as string,
    collectedAt: row.collected_at as string,
    snapshotId: row.snapshot_id as string,
  }
}

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams)
  const parsed = searchRegionSchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값을 확인해주세요.' } },
      { status: 400 }
    )
  }

  const { district, city, tradeTypes: tradeTypesStr, sizeType, minPrice, maxPrice, sort, limit } = parsed.data
  const tradeTypes = tradeTypesStr?.split(',').filter(Boolean) || []

  try {
    // 1) DB에서 먼저 조회
    let query = supabaseAdmin
      .from('listings')
      .select('*')
      .eq('district_name', district)
      .order('collected_at', { ascending: false })
      .limit(limit || 1000)

    if (tradeTypes.length > 0) query = query.in('trade_type', tradeTypes)
    if (sizeType) query = query.eq('size_type', sizeType)
    if (minPrice) query = query.gte('price', minPrice)
    if (maxPrice) query = query.lte('price', maxPrice)

    const { data: dbRows } = await query
    const latestSnapshot = dbRows?.[0]?.snapshot_id
    const dbListings = latestSnapshot
      ? (dbRows || []).filter(r => r.snapshot_id === latestSnapshot).map(mapDbRow)
      : []

    // 2) DB에 데이터가 없으면 네이버 API 실시간 호출
    let listings: Listing[]
    let source: string

    if (dbListings.length > 0) {
      listings = dbListings
      source = 'db'
    } else if (isKnownDistrict(district)) {
      const naverResults = await fetchArticles(district, {
        tradeTypes: tradeTypes.length > 0 ? tradeTypes : undefined,
        sort,
        limit: limit || 500,
      })

      listings = naverResults.map(n => ({
        ...n,
        districtCode: '',
        districtName: district,
        cityName: city || '서울시',
        collectedAt: new Date().toISOString(),
        snapshotId: 'realtime',
      }))

      // 클라이언트 사이드 필터
      if (sizeType) listings = listings.filter(l => l.sizeType === sizeType)
      if (minPrice) listings = listings.filter(l => l.price >= minPrice)
      if (maxPrice) listings = listings.filter(l => l.price <= maxPrice)

      source = 'realtime'
    } else {
      listings = []
      source = 'none'
    }

    const totalPrice = listings.reduce((sum, l) => sum + l.price, 0)
    const avgPrice = listings.length > 0 ? Math.round(totalPrice / listings.length) : 0

    const meta: SearchMeta & { source: string } = {
      total: listings.length,
      district,
      city: city || listings[0]?.cityName || '서울시',
      avgPrice,
      avgPriceDisplay: formatPriceShort(avgPrice),
      source,
    }

    const response: ApiResponse<{ listings: Listing[]; meta: typeof meta }> = {
      success: true,
      data: { listings, meta },
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

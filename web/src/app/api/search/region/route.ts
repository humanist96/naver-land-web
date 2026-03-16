import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { searchRegionSchema } from '@/lib/validators'
import { formatPriceShort } from '@/domain/price'
import type { ApiResponse } from '@/types/api'
import type { Listing, SearchMeta } from '@/types/listing'

function mapRow(row: Record<string, unknown>): Listing {
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

  try {
    const { district, tradeTypes, sizeType, minPrice, maxPrice, sort, limit } = parsed.data

    // 최신 snapshot의 매물을 DB에서 조회
    let query = supabaseAdmin
      .from('listings')
      .select('*')
      .eq('district_name', district)
      .order('collected_at', { ascending: false })
      .limit(limit || 1000)

    if (tradeTypes) {
      const types = tradeTypes.split(',').filter(Boolean)
      if (types.length > 0) {
        query = query.in('trade_type', types)
      }
    }

    if (sizeType) {
      query = query.eq('size_type', sizeType)
    }

    if (minPrice) {
      query = query.gte('price', minPrice)
    }

    if (maxPrice) {
      query = query.lte('price', maxPrice)
    }

    if (sort === 'prc') {
      query = query.order('price', { ascending: true })
    } else if (sort === 'spc') {
      query = query.order('exclusive_area', { ascending: false })
    } else if (sort === 'date') {
      query = query.order('confirm_date', { ascending: false })
    }

    const { data: rows, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    // 최신 snapshot만 필터 (같은 snapshot_id)
    const allListings = (rows || []).map(mapRow)
    const latestSnapshot = allListings[0]?.snapshotId
    const listings = latestSnapshot
      ? allListings.filter(l => l.snapshotId === latestSnapshot)
      : allListings

    const totalPrice = listings.reduce((sum, l) => sum + l.price, 0)
    const avgPrice = listings.length > 0 ? Math.round(totalPrice / listings.length) : 0

    const meta: SearchMeta = {
      total: listings.length,
      district,
      city: listings[0]?.cityName || params.city || '',
      avgPrice,
      avgPriceDisplay: formatPriceShort(avgPrice),
    }

    const response: ApiResponse<{ listings: Listing[]; meta: SearchMeta }> = {
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

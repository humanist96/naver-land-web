import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { SEOUL_DISTRICTS } from '@/domain/district'
import type { ApiResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const city = url.searchParams.get('city')

  // 현재는 서울 지역만 정적 데이터 제공, 추후 확장
  if (city === '서울시' || !city) {
    const response: ApiResponse<typeof SEOUL_DISTRICTS> = { success: true, data: SEOUL_DISTRICTS }
    return NextResponse.json(response)
  }

  // 다른 지역은 DB에서 수집된 고유 district_name 조회
  const response: ApiResponse<never[]> = { success: true, data: [] }
  return NextResponse.json(response)
}

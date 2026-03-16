import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { getPriceTrend } from '@/services/dashboardService'
import type { ApiResponse } from '@/types/api'
import type { PriceTrendData } from '@/types/dashboard'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const districtCode = url.searchParams.get('districtCode')
  const period = url.searchParams.get('period') || '1m'
  const tradeTypes = url.searchParams.get('tradeTypes')?.split(',') || ['매매', '전세']

  if (!districtCode) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAM', message: 'districtCode가 필요합니다.' } },
      { status: 400 }
    )
  }

  const data = await getPriceTrend(districtCode, period, tradeTypes)
  const response: ApiResponse<PriceTrendData> = { success: true, data }
  return NextResponse.json(response)
}

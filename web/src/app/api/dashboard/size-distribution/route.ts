import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { getSizeDistribution } from '@/services/dashboardService'
import type { ApiResponse } from '@/types/api'
import type { SizeDistributionData } from '@/types/dashboard'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const districtCode = url.searchParams.get('districtCode')
  const tradeType = url.searchParams.get('tradeType') || '매매'

  if (!districtCode) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAM', message: 'districtCode가 필요합니다.' } },
      { status: 400 }
    )
  }

  const data = await getSizeDistribution(districtCode, tradeType)
  const response: ApiResponse<SizeDistributionData[]> = { success: true, data }
  return NextResponse.json(response)
}

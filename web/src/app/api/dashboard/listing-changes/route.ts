import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { getListingChanges } from '@/services/dashboardService'
import type { ApiResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const districtCode = url.searchParams.get('districtCode')
  const days = parseInt(url.searchParams.get('days') || '7', 10)

  if (!districtCode) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAM', message: 'districtCode가 필요합니다.' } },
      { status: 400 }
    )
  }

  const data = await getListingChanges(districtCode, days)
  const response: ApiResponse<typeof data> = { success: true, data }
  return NextResponse.json(response)
}

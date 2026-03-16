import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { getRecentChanges } from '@/services/dashboardService'
import type { ApiResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(request.url)
  const districtCode = url.searchParams.get('districtCode')
  const changeType = url.searchParams.get('changeType') || undefined
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)

  if (!districtCode) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAM', message: 'districtCode가 필요합니다.' } },
      { status: 400 }
    )
  }

  const data = await getRecentChanges(districtCode, changeType, limit)
  const response: ApiResponse<typeof data> = { success: true, data }
  return NextResponse.json(response)
}

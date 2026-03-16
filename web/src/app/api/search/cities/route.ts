import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { CITIES } from '@/domain/district'
import type { ApiResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  const response: ApiResponse<typeof CITIES> = { success: true, data: CITIES }
  return NextResponse.json(response)
}
